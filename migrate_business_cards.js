#!/usr/bin/env node

/**
 * PHASE 2: Business Cards Legacy to JSONB Migration Script
 * 
 * This script migrates all data from the legacy 'business_cards' table
 * to the new JSONB-based 'user_table_data' system.
 * 
 * Usage: node migrate_business_cards.js
 * 
 * Safety Features:
 * - Idempotent (safe to re-run)
 * - Data validation before and after migration
 * - Dry-run mode for testing
 * - Comprehensive logging
 * 
 * Requirements:
 * - Node.js environment
 * - @supabase/supabase-js package
 * - Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const BUSINESS_CARDS_TABLE_ID = 'b7e8c9d0-1234-5678-9abc-def012345678';
const DRY_RUN = process.argv.includes('--dry-run');

// Supabase client (requires service role key for admin operations)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

if (!supabaseUrl || supabaseUrl === 'your-supabase-url') {
    console.error('❌ SUPABASE_URL environment variable is required');
    process.exit(1);
}

if (!supabaseServiceKey || supabaseServiceKey === 'your-service-role-key') {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Main migration function
 */
async function migrateLegacyBusinessCards() {
    console.log('🚀 Starting Business Cards Legacy to JSONB Migration');
    console.log(`📝 Dry Run Mode: ${DRY_RUN ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📊 Target Table ID: ${BUSINESS_CARDS_TABLE_ID}\n`);

    try {
        // Step 1: Fetch all legacy business cards
        console.log('📥 Step 1: Fetching legacy business cards...');
        const { data: legacyCards, error: fetchError } = await supabase
            .from('business_cards')
            .select('*')
            .order('created_at', { ascending: true });

        if (fetchError) {
            throw new Error(`Failed to fetch legacy business cards: ${fetchError.message}`);
        }

        console.log(`✅ Found ${legacyCards.length} legacy business cards`);

        if (legacyCards.length === 0) {
            console.log('🎉 No legacy data to migrate. Migration complete!');
            return;
        }

        // Step 2: Check existing JSONB records to avoid duplicates
        console.log('\n📋 Step 2: Checking for existing JSONB records...');
        const { data: existingJsonbCards, error: existingError } = await supabase
            .from('user_table_data')
            .select('data')
            .eq('table_id', BUSINESS_CARDS_TABLE_ID);

        if (existingError) {
            console.warn(`⚠️ Warning: Could not check existing JSONB records: ${existingError.message}`);
        }

        const existingEmails = new Set();
        if (existingJsonbCards) {
            existingJsonbCards.forEach(record => {
                if (record.data && record.data.Email) {
                    existingEmails.add(record.data.Email.toLowerCase());
                }
            });
            console.log(`📊 Found ${existingEmails.size} existing JSONB business cards`);
        }

        // Step 3: Transform legacy data to JSONB format
        console.log('\n🔄 Step 3: Transforming legacy data to JSONB format...');
        const transformedRecords = [];
        let skippedCount = 0;

        for (const card of legacyCards) {
            // Skip if already exists in JSONB (based on email)
            if (card.Email && existingEmails.has(card.Email.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const transformedRecord = {
                user_id: card.user_id,
                table_id: BUSINESS_CARDS_TABLE_ID,
                data: {
                    Name: card.Name || '',
                    Job_Title: card.Job_Title || '',
                    Company: card.Company || '',
                    Phone: card.Phone || '',
                    Email: card.Email || '',
                    // Add any additional fields from the legacy table
                    migrated_from_legacy: true,
                    legacy_id: card.id || card.Email
                },
                created_at: card.created_at
            };

            transformedRecords.push(transformedRecord);
        }

        console.log(`✅ Transformed ${transformedRecords.length} records`);
        console.log(`⏭️ Skipped ${skippedCount} duplicate records`);

        if (transformedRecords.length === 0) {
            console.log('🎉 All legacy data already migrated. Migration complete!');
            return;
        }

        // Step 4: Insert transformed data (or show what would be inserted in dry-run)
        if (DRY_RUN) {
            console.log('\n🧪 DRY RUN: Would insert the following records:');
            transformedRecords.forEach((record, index) => {
                console.log(`${index + 1}. ${record.data.Name} (${record.data.Email}) - User ID: ${record.user_id}`);
            });
            console.log(`\n📊 Total records that would be migrated: ${transformedRecords.length}`);
        } else {
            console.log('\n💾 Step 4: Inserting transformed data into JSONB table...');
            
            // Insert in batches of 100 to avoid timeout issues
            const batchSize = 100;
            let insertedCount = 0;

            for (let i = 0; i < transformedRecords.length; i += batchSize) {
                const batch = transformedRecords.slice(i, i + batchSize);
                
                const { data: insertResult, error: insertError } = await supabase
                    .from('user_table_data')
                    .insert(batch);

                if (insertError) {
                    console.error(`❌ Failed to insert batch ${Math.floor(i/batchSize) + 1}: ${insertError.message}`);
                    throw insertError;
                }

                insertedCount += batch.length;
                console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
            }

            console.log(`🎉 Successfully migrated ${insertedCount} business cards!`);
        }

        // Step 5: Validation
        if (!DRY_RUN) {
            console.log('\n✅ Step 5: Validating migration...');
            const { data: finalJsonbCards, error: validationError } = await supabase
                .from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', BUSINESS_CARDS_TABLE_ID);

            if (validationError) {
                console.warn(`⚠️ Warning: Could not validate migration: ${validationError.message}`);
            } else {
                console.log(`📊 Final JSONB record count: ${finalJsonbCards.count || 0}`);
                console.log(`📊 Original legacy record count: ${legacyCards.length}`);
                
                const expectedTotal = (existingJsonbCards?.length || 0) + transformedRecords.length;
                if (finalJsonbCards.count >= expectedTotal) {
                    console.log('✅ Migration validation successful!');
                } else {
                    console.warn('⚠️ Warning: Record count mismatch. Please verify manually.');
                }
            }
        }

        console.log('\n🏁 Migration process completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Test the application to ensure business cards display correctly');
        console.log('2. Run this script with --dry-run first to preview changes');
        console.log('3. Once confident, run without --dry-run to perform actual migration');
        console.log('4. Consider running Phase 3 cleanup after validation period');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

/**
 * Performance optimization: Add GIN index for JSONB queries
 */
async function addJsonbIndex() {
    console.log('\n🔍 Adding GIN index for JSONB performance...');
    
    const indexQuery = `
        CREATE INDEX IF NOT EXISTS idx_user_table_data_gin 
        ON user_table_data USING GIN (data);
    `;

    try {
        if (!DRY_RUN) {
            const { error } = await supabase.rpc('exec_sql', { sql: indexQuery });
            if (error) {
                console.warn(`⚠️ Warning: Could not create GIN index: ${error.message}`);
                console.log('You can manually run this SQL in your Supabase dashboard:');
                console.log(indexQuery);
            } else {
                console.log('✅ GIN index created successfully');
            }
        } else {
            console.log('🧪 DRY RUN: Would create GIN index with:');
            console.log(indexQuery);
        }
    } catch (error) {
        console.warn(`⚠️ Warning: Could not create GIN index: ${error.message}`);
    }
}

// Run the migration
if (require.main === module) {
    migrateLegacyBusinessCards()
        .then(() => addJsonbIndex())
        .then(() => {
            console.log('\n🎉 All migration tasks completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateLegacyBusinessCards, addJsonbIndex };