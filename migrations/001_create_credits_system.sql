-- ===============================================
-- OCR PACKAGES CREDITS SYSTEM MIGRATION
-- Migration: 001_create_credits_system
-- Date: 2025-01-18
-- Description: Create complete credits transaction system with RLS
-- ===============================================

-- Create credits transactions table
CREATE TABLE IF NOT EXISTS credits_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_event_id TEXT UNIQUE NOT NULL,
    stripe_payment_id TEXT UNIQUE,
    stripe_price_id TEXT NOT NULL,
    delta INTEGER NOT NULL, -- positive for credits, negative for refunds
    reason TEXT NOT NULL, -- 'basic_plan_monthly', 'quick_scan_purchase', 'refund', etc.
    plan_type TEXT NOT NULL, -- 'basic', 'vision_pro', 'vision_max', 'credits'
    metadata JSONB DEFAULT '{}', -- Additional payment metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_stripe_event ON credits_transactions(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_stripe_payment ON credits_transactions(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON credits_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_plan_type ON credits_transactions(plan_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_credits_transactions_updated_at ON credits_transactions;
CREATE TRIGGER update_credits_transactions_updated_at
    BEFORE UPDATE ON credits_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- ROW LEVEL SECURITY POLICIES
-- ===============================================

-- Enable RLS
ALTER TABLE credits_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own credit transactions" ON credits_transactions;
DROP POLICY IF EXISTS "Service role can manage credit transactions" ON credits_transactions;

-- Users can view their own credit transactions
CREATE POLICY "Users can view own credit transactions" ON credits_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update credit transactions
CREATE POLICY "Service role can manage credit transactions" ON credits_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- ===============================================
-- CREDIT BALANCE MATERIALIZED VIEW
-- ===============================================

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS credits_balance_mv;

-- Create materialized view for fast credit balance lookups
CREATE MATERIALIZED VIEW credits_balance_mv AS
SELECT
    user_id,
    SUM(delta) as balance,
    COUNT(*) as transaction_count,
    MAX(created_at) as last_transaction,
    MIN(created_at) as first_transaction
FROM credits_transactions
GROUP BY user_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_credits_balance_user ON credits_balance_mv(user_id);

-- ===============================================
-- HELPER FUNCTIONS
-- ===============================================

-- Function to refresh balance view
CREATE OR REPLACE FUNCTION refresh_credits_balance()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY credits_balance_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user credit balance (real-time)
CREATE OR REPLACE FUNCTION get_user_credit_balance(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(delta), 0)
    INTO balance
    FROM credits_transactions
    WHERE user_id = target_user_id;

    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user credit balance (from materialized view - faster)
CREATE OR REPLACE FUNCTION get_user_credit_balance_fast(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT COALESCE(balance, 0)
    INTO balance
    FROM credits_balance_mv
    WHERE user_id = target_user_id;

    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits to user account (idempotent)
CREATE OR REPLACE FUNCTION add_user_credits(
    target_user_id UUID,
    credit_amount INTEGER,
    stripe_event_id TEXT,
    stripe_payment_id TEXT DEFAULT NULL,
    stripe_price_id TEXT DEFAULT 'unknown',
    transaction_reason TEXT DEFAULT 'credit_adjustment',
    transaction_plan_type TEXT DEFAULT 'manual'
)
RETURNS BOOLEAN AS $$
DECLARE
    transaction_exists BOOLEAN;
BEGIN
    -- Check if transaction already exists (idempotency)
    SELECT EXISTS(
        SELECT 1 FROM credits_transactions
        WHERE stripe_event_id = add_user_credits.stripe_event_id
        OR (stripe_payment_id IS NOT NULL AND stripe_payment_id = add_user_credits.stripe_payment_id)
    ) INTO transaction_exists;

    -- If transaction already exists, return true (already processed)
    IF transaction_exists THEN
        RETURN TRUE;
    END IF;

    -- Insert new credit transaction
    INSERT INTO credits_transactions (
        user_id,
        stripe_event_id,
        stripe_payment_id,
        stripe_price_id,
        delta,
        reason,
        plan_type
    ) VALUES (
        target_user_id,
        add_user_credits.stripe_event_id,
        add_user_credits.stripe_payment_id,
        add_user_credits.stripe_price_id,
        credit_amount,
        transaction_reason,
        transaction_plan_type
    );

    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        -- Another process already inserted this transaction
        RETURN TRUE;
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE LOG 'Error adding credits for user %: %', target_user_id, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- AUDIT TABLE FOR STRIPE EVENTS
-- ===============================================

-- Create table for storing raw Stripe events
CREATE TABLE IF NOT EXISTS stripe_events_raw (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for stripe events
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events_raw(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events_raw(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events_raw(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at ON stripe_events_raw(created_at DESC);

-- ===============================================
-- GRANT PERMISSIONS
-- ===============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON credits_transactions TO authenticated;
GRANT SELECT ON credits_balance_mv TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_credit_balance_fast(UUID) TO authenticated;

-- Service role should have full access
GRANT ALL ON credits_transactions TO service_role;
GRANT ALL ON credits_balance_mv TO service_role;
GRANT ALL ON stripe_events_raw TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ===============================================
-- INITIAL DATA / SEED
-- ===============================================

-- Add comment to track migration
COMMENT ON TABLE credits_transactions IS 'OCR Pro credits transaction log - tracks all credit additions and subtractions';
COMMENT ON TABLE stripe_events_raw IS 'Raw Stripe webhook events for audit and debugging';
COMMENT ON MATERIALIZED VIEW credits_balance_mv IS 'Materialized view for fast credit balance lookups - refresh every 5 minutes';

-- Create a test function to verify setup
CREATE OR REPLACE FUNCTION test_credits_system()
RETURNS TEXT AS $$
DECLARE
    test_result TEXT;
BEGIN
    -- Check if tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credits_transactions') THEN
        RETURN 'FAILED: credits_transactions table not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_events_raw') THEN
        RETURN 'FAILED: stripe_events_raw table not found';
    END IF;

    -- Check if materialized view exists
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'credits_balance_mv') THEN
        RETURN 'FAILED: credits_balance_mv materialized view not found';
    END IF;

    -- Check if functions exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_user_credits') THEN
        RETURN 'FAILED: add_user_credits function not found';
    END IF;

    RETURN 'SUCCESS: All credits system components created successfully';
END;
$$ LANGUAGE plpgsql;

-- Run test
SELECT test_credits_system();

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================