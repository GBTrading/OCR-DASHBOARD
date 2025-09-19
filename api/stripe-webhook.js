// ===============================================
// STRIPE WEBHOOK ENDPOINT - OCR PACKAGES INTEGRATION
// Handles payment events and credit allocation
// ===============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key (for admin operations)
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===============================================
// CREDIT MAPPING CONFIGURATION
// ===============================================
// TODO: Replace with your actual OCR Packages price IDs from Stripe Dashboard

const CREDIT_MAPPING = {
    // Subscription Plans (monthly recurring)
    'price_1S92OiEKYuxF0Ry1qxMUWYUu': {
        credits: 100,
        reason: 'basic_plan_monthly',
        plan_type: 'basic'
    },
    'price_1S92OiEKYuxF0Ry1qsjSRMUJ': {
        credits: 500,
        reason: 'vision_pro_monthly',
        plan_type: 'vision_pro'
    },
    'price_1S92OiEKYuxF0Ry1RXBk9Bwj': {
        credits: 2000,
        reason: 'vision_max_monthly',
        plan_type: 'vision_max'
    },

    // Credit Packs (one-time purchases)
    'price_1S92OiEKYuxF0Ry1OeoQ6ISZ': {
        credits: 50,
        reason: 'quick_scan_purchase',
        plan_type: 'credits'
    },
    'price_1S92OiEKYuxF0Ry1nB8Z5BNX': {
        credits: 250,
        reason: 'power_pack_purchase',
        plan_type: 'credits'
    },
    'price_1S92OhEKYuxF0Ry14QwMELPd': {
        credits: 600,
        reason: 'professional_purchase',
        plan_type: 'credits'
    },
    'price_1S92OhEKYuxF0Ry1jL3r8FZK': {
        credits: 1000,
        reason: 'enterprise_purchase',
        plan_type: 'credits'
    }
};

// ===============================================
// HELPER FUNCTIONS
// ===============================================

/**
 * Log events to Stripe audit table
 */
async function logStripeEvent(eventId, eventType, eventData, processed = false, errorMessage = null) {
    try {
        const { error } = await supabase
            .from('stripe_events_raw')
            .insert({
                event_id: eventId,
                event_type: eventType,
                event_data: eventData,
                processed: processed,
                error_message: errorMessage,
                processed_at: processed ? new Date().toISOString() : null
            });

        if (error) {
            console.error('❌ Failed to log Stripe event:', error);
        }
    } catch (err) {
        console.error('❌ Error logging Stripe event:', err);
    }
}

/**
 * Update event processing status
 */
async function updateEventStatus(eventId, processed, errorMessage = null) {
    try {
        const { error } = await supabase
            .from('stripe_events_raw')
            .update({
                processed: processed,
                processed_at: new Date().toISOString(),
                error_message: errorMessage
            })
            .eq('event_id', eventId);

        if (error) {
            console.error('❌ Failed to update event status:', error);
        }
    } catch (err) {
        console.error('❌ Error updating event status:', err);
    }
}

/**
 * Get user ID from Stripe customer ID
 */
async function getUserIdFromCustomer(customerId) {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();

        if (error || !data) {
            console.error('❌ User not found for customer:', customerId);
            return null;
        }

        return data.user_id;
    } catch (err) {
        console.error('❌ Error finding user:', err);
        return null;
    }
}

/**
 * Process successful payment
 */
async function processPaymentSuccess(event) {
    const eventType = event.type;
    const eventId = event.id;

    try {
        let session = null;
        let customerId = null;
        let priceId = null;
        let paymentIntentId = null;

        // Extract data based on event type
        if (eventType === 'checkout.session.completed') {
            session = event.data.object;
            customerId = session.customer;
            paymentIntentId = session.payment_intent;

            console.log('🔍 CHECKOUT SESSION DEBUG:');
            console.log('  📦 Session ID:', session.id);
            console.log('  👤 Customer ID:', customerId);
            console.log('  💳 Payment Intent ID:', paymentIntentId);
            console.log('  📋 Line Items Present:', !!session.line_items);

            // Get price ID from line items
            if (session.line_items && session.line_items.data.length > 0) {
                priceId = session.line_items.data[0].price.id;
                console.log('  ✅ Price ID from session line items:', priceId);
            } else {
                console.log('  🔄 Expanding session to get line items...');
                // Retrieve session with line items if not included
                const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
                    expand: ['line_items']
                });
                priceId = fullSession.line_items.data[0].price.id;
                console.log('  ✅ Price ID from expanded session:', priceId);
            }
        } else if (eventType === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            customerId = invoice.customer;
            paymentIntentId = invoice.payment_intent;

            // Get price ID from invoice line items
            if (invoice.lines && invoice.lines.data.length > 0) {
                priceId = invoice.lines.data[0].price.id;
            }
        }

        // Validate required data
        if (!customerId || !priceId) {
            const errorMsg = `Missing required data - customer: ${customerId}, price: ${priceId}`;
            console.error('❌', errorMsg);
            await updateEventStatus(eventId, false, errorMsg);
            return false;
        }

        // Check if we have credit mapping for this price
        console.log('🔍 CREDIT MAPPING LOOKUP:');
        console.log('  🔑 Looking up price ID:', priceId);
        console.log('  📚 Available mappings:', Object.keys(CREDIT_MAPPING));

        const creditConfig = CREDIT_MAPPING[priceId];

        if (!creditConfig) {
            const errorMsg = `No credit mapping found for price ID: ${priceId}`;
            console.error('❌', errorMsg);
            console.log('  🚨 MISSING MAPPING - Available price IDs:');
            Object.keys(CREDIT_MAPPING).forEach(id => {
                console.log(`    - ${id}: ${CREDIT_MAPPING[id].credits} credits`);
            });
            await updateEventStatus(eventId, false, errorMsg);
            return false;
        }

        console.log('  ✅ Found credit config:', creditConfig);
        console.log('  💰 Credits to add:', creditConfig.credits);
        console.log('  📝 Reason:', creditConfig.reason);
        console.log('  🏷️ Plan type:', creditConfig.plan_type);

        // Get user ID from customer ID
        const userId = await getUserIdFromCustomer(customerId);
        if (!userId) {
            const errorMsg = `User not found for customer: ${customerId}`;
            console.error('❌', errorMsg);
            await updateEventStatus(eventId, false, errorMsg);
            return false;
        }

        // First, verify the user exists in the auth.users table
        console.log('🔍 PRE-RPC CHECKS:');
        console.log('  👤 Verifying user exists in auth.users...');

        const { data: userCheck, error: userCheckError } = await supabase
            .from('auth.users')
            .select('id')
            .eq('id', userId)
            .single();

        console.log('  📊 User check result:', userCheck);
        console.log('  ❌ User check error:', userCheckError);

        // Check if user has any existing credit transactions
        const { data: existingTransactions, error: transactionCheckError } = await supabase
            .from('credits_transactions')
            .select('*')
            .eq('user_id', userId)
            .limit(5);

        console.log('  📊 Existing transactions:', existingTransactions?.length || 0);
        console.log('  ❌ Transaction check error:', transactionCheckError);

        // Get current user plan type to avoid constraint violations
        const { data: userSub, error: userSubError } = await supabase
            .from('user_subscriptions')
            .select('plan_type')
            .eq('user_id', userId)
            .single();

        if (userSubError || !userSub) {
            const errorMsg = `Failed to get user subscription: ${userSubError?.message || 'Not found'}`;
            console.error('❌', errorMsg);
            await updateEventStatus(eventId, false, errorMsg);
            return false;
        }

        // Add credits using the correct function that updates balance
        console.log('🔍 SUPABASE RPC CALL:');
        console.log('  👤 User ID:', userId);
        console.log('  💰 Credit Amount (FINAL):', creditConfig.credits);
        console.log('  🔗 Stripe Event ID:', eventId);
        console.log('  💳 Payment ID:', paymentIntentId);
        console.log('  🏷️ Price ID:', priceId);
        console.log('  📝 Reason:', creditConfig.reason);
        console.log('  📋 Current Plan Type:', userSub.plan_type);

        const { data, error } = await supabase.rpc('add_credits_payment', {
            p_user_id: userId,
            p_credits_to_add: creditConfig.credits,
            p_plan_type: userSub.plan_type // Keep current plan type
        });

        console.log('🔍 SUPABASE RPC RESULT:');
        console.log('  📊 Data:', data);
        console.log('  ❌ Error:', error);

        // Also log the transaction for audit purposes
        if (!error && data?.success) {
            console.log('📝 Logging transaction for audit...');
            await supabase.rpc('add_user_credits', {
                target_user_id: userId,
                credit_amount: creditConfig.credits,
                stripe_event_id: eventId,
                stripe_payment_id: paymentIntentId,
                stripe_price_id: priceId,
                transaction_reason: creditConfig.reason,
                transaction_plan_type: creditConfig.plan_type
            });
        }

        console.log('🔍 SUPABASE RPC RESULT:');
        console.log('  📊 Data:', data);
        console.log('  ❌ Error:', error);

        // If RPC failed, try to get more details
        if (data === false || error) {
            console.log('🚨 RPC FAILED - Investigating further...');

            // Try a direct insert to see what happens
            const { data: directInsert, error: directError } = await supabase
                .from('credits_transactions')
                .insert({
                    user_id: userId,
                    stripe_event_id: `debug_${eventId}`,
                    stripe_payment_id: paymentIntentId,
                    stripe_price_id: priceId,
                    delta: creditConfig.credits,
                    reason: creditConfig.reason,
                    plan_type: creditConfig.plan_type
                });

            console.log('  🔍 Direct insert result:', directInsert);
            console.log('  ❌ Direct insert error:', directError);
        }

        // Check for both error object and RPC function failure
        if (error || !data?.success) {
            const errorMsg = error
                ? `Failed to add credits: ${error.message}`
                : `RPC function failed - likely database constraint or policy issue`;
            console.error('❌', errorMsg);
            await updateEventStatus(eventId, false, errorMsg);
            return false;
        }

        console.log(`✅ Added ${creditConfig.credits} credits to user ${userId} (reason: ${creditConfig.reason})`);
        console.log(`💰 New credit balance: ${data.new_balance}`);
        await updateEventStatus(eventId, true);
        return true;

    } catch (err) {
        const errorMsg = `Error processing payment: ${err.message}`;
        console.error('❌', errorMsg);
        await updateEventStatus(eventId, false, errorMsg);
        return false;
    }
}

// ===============================================
// MAIN WEBHOOK HANDLER
// ===============================================

module.exports = async (req, res) => {
    // Ensure this is a POST request
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Verify webhook signature
        const rawBody = req.rawBody || req.body;
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        console.log(`📨 Received webhook: ${event.type} (${event.id})`);
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    // Log the event for audit purposes
    await logStripeEvent(event.id, event.type, event.data.object, false);

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                console.log('🛒 Processing checkout session completed...');
                await processPaymentSuccess(event);
                break;

            case 'invoice.payment_succeeded':
                console.log('📧 Processing invoice payment succeeded...');
                await processPaymentSuccess(event);
                break;

            case 'payment_intent.payment_failed':
                console.log('❌ Payment failed:', event.data.object.id);
                await updateEventStatus(event.id, true, 'Payment failed - no action needed');
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                console.log(`🔄 Subscription event: ${event.type}`);
                // These are handled by payment success events, just log for audit
                await updateEventStatus(event.id, true, 'Subscription event logged');
                break;

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
                await updateEventStatus(event.id, true, 'Unhandled event type');
        }

        // Return success response
        res.status(200).json({
            received: true,
            event_id: event.id,
            event_type: event.type
        });

    } catch (err) {
        console.error('❌ Error handling webhook:', err);
        await updateEventStatus(event.id, false, err.message);

        res.status(500).json({
            error: 'Webhook processing failed',
            event_id: event.id
        });
    }
};

// ===============================================
// CONFIGURATION VALIDATION
// ===============================================

// Validate environment variables on startup
const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
    }
}

// Validate credit mapping on startup
const mappingErrors = [];
for (const [priceId, config] of Object.entries(CREDIT_MAPPING)) {
    if (priceId.includes('REPLACE_WITH_ACTUAL')) {
        mappingErrors.push(`❌ Placeholder price ID found: ${priceId}`);
    }
    if (!config.credits || !config.reason || !config.plan_type) {
        mappingErrors.push(`❌ Invalid config for ${priceId}: missing credits, reason, or plan_type`);
    }
}

if (mappingErrors.length > 0) {
    console.warn('🚨 CREDIT MAPPING CONFIGURATION ISSUES:');
    mappingErrors.forEach(error => console.warn(error));
    console.warn('🚨 Update CREDIT_MAPPING with real Stripe price IDs before production use!');
}

console.log('✅ Stripe webhook endpoint initialized successfully');
console.log(`📊 Configured for ${Object.keys(CREDIT_MAPPING).length} price IDs`);