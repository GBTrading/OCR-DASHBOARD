# Billing Dashboard Fix Plan

This document outlines the systematic fixes needed to resolve billing dashboard discrepancies in the OCR application.

## Issues Identified

1. **Credit purchase events contaminating metrics**: The materialized view `user_metrics_summary` includes "credit_purchase" document types in processing metrics
2. **Billing UI showing incorrect usage**: Still displaying "69/20" instead of actual "32/100" for starter plan user
3. **Hours saved calculation is wrong**: Showing 1 hour instead of ~2.13 hours (32 documents × 4 minutes ÷ 60)

## Root Cause Analysis

- **Data Layer**: Materialized view aggregates ALL processing_events including non-document events
- **Frontend Layer**: Hardcoded values and integer division causing display/calculation errors
- **Synchronization**: No auto-refresh of materialized view leading to stale data

## Part 1: Fix Data Aggregation in `user_metrics_summary`

### Problem
The materialized view includes `credit_purchase` events, inflating document/page counts.

### Solution
Recreate the materialized view with proper filtering:

```sql
-- Step 1: Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS public.user_metrics_summary;

-- Step 2: Recreate with filtering
CREATE MATERIALIZED VIEW public.user_metrics_summary AS
SELECT
    user_id,
    document_type,
    date_trunc('month', processed_at) AS month,
    date_trunc('day', processed_at) AS day,
    sum(documents_processed_delta) AS total_documents_processed,
    sum(value_created_delta) AS total_value_created,
    sum(hours_saved_delta) AS total_hours_saved,
    sum(pages_processed_delta) AS total_pages_processed,
    count(*) AS processing_events_count,
    min(processed_at) AS first_processed_at,
    max(processed_at) AS last_processed_at
FROM processing_events
WHERE document_type NOT IN ('credit_purchase', 'stripe_payment')  -- Exclude non-document events
GROUP BY user_id, document_type, month, day;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_metrics_summary_user_id
ON public.user_metrics_summary(user_id);

-- Step 4: Refresh to populate with correct data
REFRESH MATERIALIZED VIEW public.user_metrics_summary;
```

## Part 2: Fix RPC Function for Accurate Data Retrieval

### Problem
The `get_user_dashboard_metrics` RPC may not be properly calculating hours or handling plan limits.

### Solution
Update the RPC function to:
1. Use floating-point arithmetic for hours calculation
2. Ensure proper aggregation from filtered data
3. Return all necessary billing information

```sql
CREATE OR REPLACE FUNCTION get_user_dashboard_metrics()
RETURNS TABLE(
    total_documents_processed BIGINT,
    total_value_created NUMERIC,
    total_hours_saved NUMERIC,
    monthly_pages_processed BIGINT,
    monthly_pages_limit INTEGER,
    credits_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(sum(ums.total_documents_processed), 0) AS total_documents_processed,
        COALESCE(sum(ums.total_value_created), 0) AS total_value_created,
        -- Fix hours calculation using floating-point arithmetic
        COALESCE(sum(ums.total_hours_saved), 0) AS total_hours_saved,
        COALESCE(sum(ums.total_pages_processed)
            FILTER (WHERE ums.month = date_trunc('month', now())), 0) AS monthly_pages_processed,
        COALESCE(us.pages_limit, 20) AS monthly_pages_limit,  -- Default to 20 for trial
        COALESCE(us.credits_remaining, 0) AS credits_remaining
    FROM public.user_subscriptions us
    LEFT JOIN public.user_metrics_summary ums ON ums.user_id = us.user_id
    WHERE us.user_id = auth.uid()
    GROUP BY us.pages_limit, us.credits_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Part 3: Frontend Code Fixes

### Problem
Hardcoded values and incorrect data consumption in JavaScript.

### Solution Areas

1. **Remove hardcoded plan limits**: Search for any references to trial plan showing "50" or "20" pages
2. **Fix usage display**: Ensure billing section pulls from RPC function data
3. **Hours calculation**: Move calculation to backend or fix frontend floating-point arithmetic

### Key Files to Update
- `app.js`: Lines with billing usage display logic
- Plan limit constants that may override RPC data
- Hours saved calculation logic

## Part 4: Implementation Steps

### Database Changes
1. Apply materialized view recreation migration
2. Update RPC function
3. Verify trigger still works for auto-refresh

### Frontend Changes
1. Audit hardcoded plan limits in `app.js`
2. Ensure billing UI pulls from RPC data exclusively
3. Fix hours saved display calculation
4. Clear any client-side caching of stale data

### Testing
1. Verify materialized view excludes credit_purchase events
2. Test RPC function returns correct data
3. Confirm billing UI shows "32/100" for starter plan user
4. Validate hours saved shows ~2.1 hours (32 docs × 4 min ÷ 60)

## Expected Results After Fixes

- **Documents Processed**: 32 (excluding credit purchases)
- **Usage Display**: "32/100 pages used" (starter plan)
- **Hours Saved**: "~2.1 hours saved"
- **Credits**: 282 remaining (unchanged)
- **Real-time Updates**: Materialized view auto-refreshes on new processing events

## Verification Queries

```sql
-- Check filtered data in materialized view
SELECT user_id, document_type, total_documents_processed, total_pages_processed
FROM user_metrics_summary
WHERE user_id = 'dd6668e4-2d53-40dc-9241-297c69d00d40'
AND month = date_trunc('month', CURRENT_DATE);

-- Test RPC function output
SELECT * FROM get_user_dashboard_metrics();

-- Verify no credit_purchase events in view
SELECT DISTINCT document_type FROM user_metrics_summary;
```

This systematic approach ensures data accuracy from the database level up to the UI display layer.