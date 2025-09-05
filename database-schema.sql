-- =====================================================
-- Cross-Device Sessions Schema for OCR Dashboard
-- Execute this in Supabase SQL Editor
-- =====================================================

-- Create the session status enum type
CREATE TYPE session_status AS ENUM (
    'pending',   -- Initial state, waiting for QR scan
    'scanned',   -- QR code scanned, waiting for upload
    'uploaded',  -- File uploaded to temp storage, waiting for desktop confirmation
    'completed', -- Desktop confirmed and moved file to permanent storage
    'expired'    -- Session timed out
);

-- Create the cross_device_sessions table
CREATE TABLE public.cross_device_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status session_status NOT NULL DEFAULT 'pending',
    file_path TEXT, -- Path to temp file in Supabase Storage
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes'
);

-- Create indexes for efficient queries
CREATE INDEX idx_cross_device_sessions_user_id ON public.cross_device_sessions(user_id);
CREATE INDEX idx_cross_device_sessions_expires_at ON public.cross_device_sessions(expires_at);
CREATE INDEX idx_cross_device_sessions_status ON public.cross_device_sessions(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cross_device_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only manage their own sessions
CREATE POLICY "Allow users to manage their own sessions"
ON public.cross_device_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.cross_device_sessions TO authenticated;
GRANT SELECT ON public.cross_device_sessions TO anon;

-- Create a function to get session status (used by desktop for polling fallback)
CREATE OR REPLACE FUNCTION get_session_status(session_id uuid)
RETURNS session_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_status_result session_status;
BEGIN
    -- Check if session exists and belongs to the authenticated user
    SELECT status INTO session_status_result
    FROM public.cross_device_sessions
    WHERE id = session_id 
    AND user_id = auth.uid();
    
    -- Return null if session not found or doesn't belong to user
    RETURN session_status_result;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_session_status(uuid) TO authenticated;

-- Create a function for cleanup (will be called by Edge Function)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(
    session_id uuid,
    file_path_to_delete TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Return sessions that need cleanup
    RETURN QUERY
    SELECT 
        id as session_id,
        file_path as file_path_to_delete
    FROM public.cross_device_sessions
    WHERE expires_at < now()
    AND status IN ('pending', 'scanned', 'uploaded');
    
    -- Delete expired sessions
    DELETE FROM public.cross_device_sessions
    WHERE expires_at < now()
    AND status IN ('pending', 'scanned', 'uploaded');
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated;

-- =====================================================
-- Enhanced Scheduled Cleanup System
-- =====================================================

-- Function to handle expired sessions by calling the Edge Function
CREATE OR REPLACE FUNCTION handle_expired_sessions()
RETURNS void AS $$
DECLARE
    session_record RECORD;
    cleanup_url TEXT;
    request_body TEXT;
    response_data JSONB;
BEGIN
    -- Get the Supabase project URL for Edge Function calls
    cleanup_url := current_setting('app.supabase_url', true) || '/functions/v1/cleanup-session-files';
    
    -- Process expired sessions for deletion
    FOR session_record IN
        SELECT id, user_id, status, file_path
        FROM public.cross_device_sessions
        WHERE expires_at < NOW() 
        AND status IN ('pending', 'scanned', 'uploaded')
    LOOP
        BEGIN
            -- Prepare request body for Edge Function
            request_body := jsonb_build_object('session_id', session_record.id)::text;
            
            -- Call the cleanup Edge Function
            SELECT content INTO response_data
            FROM http((
                'POST',
                cleanup_url,
                ARRAY[
                    http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
                    http_header('Content-Type', 'application/json')
                ],
                'application/json',
                request_body
            )::http_request);
            
            -- Log the session deletion attempt
            RAISE NOTICE 'Session deletion called for session % - Response: %', session_record.id, response_data;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue processing other sessions
            RAISE WARNING 'Failed to delete session %: %', session_record.id, SQLERRM;
            
            -- Mark session as expired even if deletion failed (will be retried next cycle)
            UPDATE public.cross_device_sessions 
            SET status = 'expired' 
            WHERE id = session_record.id;
        END;
    END LOOP;
    
    -- Also clean up very old expired sessions (older than 24 hours)
    -- Note: Successfully cleaned sessions are already deleted by Edge Function
    DELETE FROM public.cross_device_sessions
    WHERE expires_at < NOW() - INTERVAL '24 hours'
    AND status = 'expired';
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION handle_expired_sessions() TO authenticated;

-- Schedule the cleanup function to run every 5 minutes
-- Note: This requires the pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-sessions', '*/5 * * * *', 'SELECT handle_expired_sessions()');

-- Note: Uncomment the above line after enabling pg_cron extension in Supabase