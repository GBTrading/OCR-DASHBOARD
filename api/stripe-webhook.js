// Stripe webhook handler for processing successful payments
// This file should be deployed as a serverless function (Vercel, Netlify, etc.)

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Supabase with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY // This needs to be set in environment variables
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Get raw body for signature verification
    const rawBody = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook received:', event.type);

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const sessionId = session.id;

    console.log('Payment completed for user:', userId);

    if (!userId) {
      console.error('No user ID found in checkout session');
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
      const planType = session.metadata?.plan_type || 'basic';
      let creditsToAdd;

      switch (planType.toLowerCase()) {
        case 'basic':
          creditsToAdd = 100; // Basic plan gets 100 credits
          break;
        case 'pro':
        case 'business':
          creditsToAdd = 5000; // Pro plan gets 5000 credits
          break;
        case 'enterprise':
          creditsToAdd = 25000; // Enterprise plan gets 25000 credits
          break;
        default:
          creditsToAdd = 100; // Default to basic
      }

      console.log(`Adding ${creditsToAdd} credits for ${planType} plan`);

      // Add credits using the Supabase function
      const { data: result, error: creditError } = await supabase
        .rpc('add_credits', {
          p_user_id: userId,
          p_credits_to_add: creditsToAdd,
          p_plan_type: planType
        });

      if (creditError) {
        console.error('Error adding credits:', creditError);
        throw new Error(`Failed to add credits: ${creditError.message}`);
      }

      console.log('Credits added successfully:', result);

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