// API endpoint for creating Stripe checkout sessions
// This file should be deployed as a serverless function (Vercel, Netlify, etc.)

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gidcaqjahzuvmmqlaohj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
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

    // Create Stripe customer if doesn't exist
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
    const stripeSessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'payment', // Use 'payment' for one-time payments
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