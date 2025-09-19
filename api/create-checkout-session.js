// API endpoint for creating Stripe checkout sessions
// This file should be deployed as a serverless function (Vercel, Netlify, etc.)

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment variables
console.log('🔍 COMPREHENSIVE Environment Debug:');
console.log('  Runtime:', process.version);
console.log('  Platform:', process.platform);
console.log('  All Environment Keys:', Object.keys(process.env).length);
console.log('  STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? `Present (${process.env.STRIPE_SECRET_KEY.substring(0,10)}...)` : 'MISSING');
console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? `Present (${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0,20)}...)` : 'MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0,10)}...)` : 'MISSING');
console.log('  VERCEL env vars:', Object.keys(process.env).filter(key => key.includes('VERCEL')).length);
console.log('  First 10 env keys:', Object.keys(process.env).slice(0, 10));

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required but not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  // 🚨 CANARY LOG - v2 with dynamic mode selection
  console.log('🚨 API ENDPOINT HIT - v2 with dynamic mode selection');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, userId, planType } = req.body;

    // 🔍 CRITICAL DEBUG: Log everything about the incoming request
    console.log('🚨 CRITICAL DEBUG - Checkout Session Creation:');
    console.log('  📥 Request body:', { priceId, userId, planType });
    console.log('  🔐 Request headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'user-agent': req.headers['user-agent'],
      origin: req.headers.origin
    });
    console.log('  👤 User ID from request body:', userId);
    console.log('  👤 User ID type:', typeof userId);

    // Enhanced input validation
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({ error: 'Valid User ID is required' });
    }

    if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      return res.status(400).json({ error: 'Valid Stripe Price ID is required' });
    }

    if (!planType || typeof planType !== 'string') {
      return res.status(400).json({ error: 'Plan type is required' });
    }

    // Verify user exists in Supabase or create default subscription
    let { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id, user_id')
      .eq('user_id', userId)
      .single();

    // If no subscription exists, create a default one
    if (subError && subError.code === 'PGRST116') {
      console.log('No subscription found, creating default subscription for user:', userId);

      const { data: newSub, error: createError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'trial',
          pages_limit: 50,
          credits_remaining: 50,
          plan_status: 'active'
        })
        .select('stripe_customer_id, user_id')
        .single();

      if (createError) {
        console.error('Error creating default subscription:', createError);
        return res.status(500).json({ error: 'Failed to create user subscription' });
      }

      subscription = newSub;
    } else if (subError) {
      console.error('Error fetching user subscription:', subError);
      return res.status(400).json({ error: 'Database error' });
    }

    let customerId = subscription.stripe_customer_id;

    // Validate existing customer or create new one
    if (customerId) {
      try {
        // Test if customer exists in current Stripe mode
        await stripe.customers.retrieve(customerId);
        console.log('✅ Existing customer validated:', customerId);
      } catch (error) {
        console.log('❌ Customer not found in current mode, creating new one:', error.message);
        customerId = null; // Force creation of new customer
      }
    }

    // Create Stripe customer if doesn't exist or is invalid
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          user_id: userId
        }
      });
      customerId = customer.id;

      // Save customer ID to Supabase
      await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // 🔍 CRITICAL DEBUG: Log Stripe parameters before API call
    // Determine checkout mode based on plan type
    const subscriptionPlanTypes = ['basic', 'vision_pro', 'vision_max'];
    const mode = subscriptionPlanTypes.includes(planType) ? 'subscription' : 'payment';

    console.log('🚨🚨 CANARY MODE LOGIC - EXECUTING v2 CODE:');
    console.log('  📋 Plan Type received:', planType);
    console.log('  📝 Subscription Plan Types array:', subscriptionPlanTypes);
    console.log('  🔄 Determined Mode:', mode);
    console.log('  ✅ Mode selection logic is working!');

    const stripeSessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: mode, // Dynamic mode: 'subscription' for recurring, 'payment' for one-time
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?payment_canceled=true`,
      client_reference_id: userId, // This is crucial - links payment to user
      metadata: {
        user_id: userId,
        plan_type: planType || 'basic'
      }
    };

    console.log('🚨 CRITICAL DEBUG - Stripe API Call Parameters:');
    console.log('  💳 Customer ID:', customerId);
    console.log('  🔗 client_reference_id:', stripeSessionParams.client_reference_id);
    console.log('  📋 metadata.user_id:', stripeSessionParams.metadata.user_id);
    console.log('  📦 Full Stripe params:', JSON.stringify(stripeSessionParams, null, 2));

    // Create checkout session
    const session = await stripe.checkout.sessions.create(stripeSessionParams);

    console.log('Checkout session created:', session.id);

    res.status(200).json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
};