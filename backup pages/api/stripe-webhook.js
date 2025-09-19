// Stripe webhook handler for processing successful payments
// This file should be deployed as a serverless function (Vercel, Netlify, etc.)

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Supabase with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY // This needs to be set in environment variables
);

module.exports = async (req, res) => {
  console.log('🔍 Webhook called at:', new Date().toISOString());
  console.log('🔍 Method:', req.method);
  console.log('🔍 Environment check:');
  console.log('  - STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing');
  console.log('  - STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers && req.headers['stripe-signature'];
  let event;

  try {
    // Get raw body for signature verification
    const rawBody = req.rawBody || req.body;
    console.log('🔍 Raw body length:', rawBody?.length || 'undefined');
    console.log('🔍 Signature present:', sig ? '✅' : '❌');

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log('✅ Webhook signature verified successfully');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🎯 Webhook received:', event.type);
  console.log('🔍 Event ID:', event.id);
  console.log('🔍 Full event data:', JSON.stringify(event.data.object, null, 2));

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const sessionId = session.id;
    const customerId = session.customer;

    console.log('💰 Payment completed!');
    console.log('🔍 Session details:');
    console.log('  - Session ID:', sessionId);
    console.log('  - User ID (client_reference_id):', userId);
    console.log('  - Customer ID:', customerId);
    console.log('  - Amount total:', session.amount_total);
    console.log('  - Currency:', session.currency);
    console.log('  - Payment status:', session.payment_status);
    console.log('  - Metadata:', session.metadata);

    if (!userId) {
      console.error('❌ CRITICAL: No user ID found in checkout session');
      console.log('🔍 This means client_reference_id was not set when creating the checkout session');
      return res.status(400).json({ error: 'No user ID in session' });
    }

    try {
      // Check for duplicate processing (idempotency)
      const { data: existingEvent } = await supabase
        .from('processing_events')
        .select('id')
        .eq('source_document_id', sessionId)
        .single();

      if (existingEvent) {
        console.log('Payment already processed for session:', sessionId);
        return res.status(200).json({ received: true, note: 'Already processed' });
      }

      // Determine credits to add based on plan
      let planType = session.metadata?.plan_type || 'basic';
      let creditsToAdd;

      console.log('💳 Determining credits to add:');
      console.log('  - Plan type from metadata:', planType);

      // Map plan types to match database constraints: ['trial', 'starter', 'business', 'pay_as_you_go']
      let mappedPlanType = planType.toLowerCase();

      switch (mappedPlanType) {
        case 'basic':
          creditsToAdd = 100; // Basic plan gets 100 credits
          mappedPlanType = 'starter'; // Map to valid constraint value
          break;
        case 'starter':
          creditsToAdd = 100; // Starter plan gets 100 credits
          break;
        case 'pro':
        case 'business':
          creditsToAdd = 5000; // Business plan gets 5000 credits
          mappedPlanType = 'business'; // Ensure it matches constraint
          break;
        case 'enterprise':
          creditsToAdd = 25000; // Enterprise plan gets 25000 credits
          mappedPlanType = 'business'; // Map to closest valid constraint value
          break;
        case 'pay_as_you_go':
          creditsToAdd = 500; // Pay-as-you-go gets 500 credits
          break;
        default:
          creditsToAdd = 100; // Default credits
          mappedPlanType = 'starter'; // Default to starter
      }

      console.log(`🔄 Plan type mapping: "${planType}" → "${mappedPlanType}"`);
      planType = mappedPlanType; // Use mapped plan type for RPC call

      console.log(`🎯 Adding ${creditsToAdd} credits for ${planType} plan`);

      // ENHANCED LOGGING: Validate parameters before RPC call
      console.log('🔍 CRITICAL DEBUG - Pre-RPC validation:');
      console.log('  - userId type:', typeof userId, 'value:', userId);
      console.log('  - creditsToAdd type:', typeof creditsToAdd, 'value:', creditsToAdd);
      console.log('  - planType type:', typeof planType, 'value:', planType);

      if (!userId || !creditsToAdd || creditsToAdd <= 0) {
        console.error('❌ CRITICAL: Invalid parameters for add_credits');
        console.log('  - userId valid:', !!userId);
        console.log('  - creditsToAdd valid:', !!(creditsToAdd && creditsToAdd > 0));
        throw new Error('Invalid parameters for credit update');
      }

      // Add credits using the Supabase function
      console.log('🗄️ Calling Supabase add_credits function...');
      console.log('  - User ID:', userId);
      console.log('  - Credits to add:', creditsToAdd);
      console.log('  - Plan type:', planType);

      const { data: result, error: creditError } = await supabase
        .rpc('add_credits_payment', {
          p_user_id: userId,
          p_credits_to_add: creditsToAdd,
          p_plan_type: planType
        });

      // ENHANCED LOGGING: Detailed RPC response analysis
      console.log('🔍 CRITICAL DEBUG - Post-RPC analysis:');
      console.log('  - creditError:', creditError);
      console.log('  - result type:', typeof result);
      console.log('  - result value:', result);

      if (Array.isArray(result)) {
        console.log('  - result array length:', result.length);
        console.log('  - result contents:', JSON.stringify(result, null, 2));
      }

      if (creditError) {
        console.error('❌ CRITICAL: Error adding credits:', creditError);
        console.log('🔍 Full error details:', JSON.stringify(creditError, null, 2));
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      console.log('✅ Credits added successfully!');
      console.log('🔍 Result:', result);

      // Log the payment event for tracking
      const { error: eventError } = await supabase
        .from('processing_events')
        .insert({
          user_id: userId,
          source_document_id: sessionId,
          document_type: 'stripe_payment',
          processed_at: new Date().toISOString(),
          documents_processed_delta: 0,
          pages_processed_delta: 0,
          value_created_delta: 0,
          hours_saved_delta: 0,
          metadata: {
            event_type: 'payment_completed',
            session_id: sessionId,
            plan_type: planType,
            credits_added: creditsToAdd,
            payment_amount: session.amount_total,
            currency: session.currency
          }
        });

      if (eventError) {
        console.error('Error logging payment event:', eventError);
        // Don't fail the webhook for logging errors
      }

      console.log(`Successfully processed payment for user ${userId}: +${creditsToAdd} credits`);

    } catch (error) {
      console.error('Error processing payment webhook:', error);
      return res.status(500).json({ error: 'Failed to process payment' });
    }
  }

  res.status(200).json({ received: true });
};