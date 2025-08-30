-- Migration: Create user_settings table for OCR Pro Dashboard
-- Run this migration manually in your Supabase SQL editor

-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_document_type TEXT DEFAULT '',
    email_notifications BOOLEAN DEFAULT false,
    auto_save_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only access their own settings
CREATE POLICY "Users can only access their own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add comment
COMMENT ON TABLE user_settings IS 'Stores user preferences and settings for OCR Pro dashboard';
