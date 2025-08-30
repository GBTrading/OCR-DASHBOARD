-- STREAMLINED Business Cards Migration (SQL Version)
-- 
-- This migrates legacy 'business_cards' table data to 'user_table_data' JSONB system.
-- Run in Supabase SQL Editor
--
-- ⚠️ IMPORTANT: Run Step 1 first to preview, then uncomment Step 2 to migrate

-- Step 1: PREVIEW what will be migrated (RUN THIS FIRST)
SELECT 
    user_id,
    'b7e8c9d0-1234-5678-9abc-def012345678' as table_id,
    jsonb_build_object(
        'Name', COALESCE("Name", ''),
        'Job_Title', COALESCE("Job_Title", ''),
        'Company', COALESCE("Company", ''),
        'Phone', COALESCE("Phone", ''),
        'Email', COALESCE("Email", ''),
        'migrated_from_legacy', true
    ) as data,
    created_at
FROM business_cards
WHERE NOT EXISTS (
    -- Skip if already migrated (check by email)
    SELECT 1 FROM user_table_data 
    WHERE table_id = 'b7e8c9d0-1234-5678-9abc-def012345678' 
    AND data->>'Email' = business_cards."Email"
)
ORDER BY created_at;

-- Step 2: ACTUAL MIGRATION (uncomment when ready)
/*
INSERT INTO user_table_data (user_id, table_id, data, created_at)
SELECT 
    user_id,
    'b7e8c9d0-1234-5678-9abc-def012345678' as table_id,
    jsonb_build_object(
        'Name', COALESCE("Name", ''),
        'Job_Title', COALESCE("Job_Title", ''),
        'Company', COALESCE("Company", ''),
        'Phone', COALESCE("Phone", ''),
        'Email', COALESCE("Email", ''),
        'migrated_from_legacy', true
    ) as data,
    created_at
FROM business_cards
WHERE NOT EXISTS (
    SELECT 1 FROM user_table_data 
    WHERE table_id = 'b7e8c9d0-1234-5678-9abc-def012345678' 
    AND data->>'Email' = business_cards."Email"
);
*/

-- Step 3: Add JSONB performance index (uncomment when ready)
/*
CREATE INDEX IF NOT EXISTS idx_user_table_data_table_id ON user_table_data (table_id);
CREATE INDEX IF NOT EXISTS idx_user_table_data_gin ON user_table_data USING GIN (data);
*/

-- Step 4: VALIDATION (run after migration)
-- Check counts
SELECT 'Legacy Count' as source, COUNT(*) as count FROM business_cards
UNION ALL
SELECT 'JSONB Count' as source, COUNT(*) as count FROM user_table_data 
WHERE table_id = 'b7e8c9d0-1234-5678-9abc-def012345678';

-- Step 5: DEPRECATE legacy table (after validation period)
/*
-- Rename legacy table instead of dropping (safer)
ALTER TABLE business_cards RENAME TO business_cards_deprecated_20240130;
*/