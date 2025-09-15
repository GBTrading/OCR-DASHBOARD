# Stripe Payment Integration Implementation Guide

## 🎯 **Project Overview**
Transform your OCR dashboard into a monetized SaaS platform by integrating Stripe payment processing with your existing Supabase infrastructure.

## 📊 **Current Database Analysis**

### **Existing Tables (Perfect Foundation!)**
- ✅ **`user_subscriptions`** - Already has Stripe integration fields
- ✅ **`processing_events`** - Perfect event sourcing for credit tracking
- ✅ **`usage_tracking`** - Basic usage metrics
- ✅ **`user_settings`** - User preferences
- ✅ **Auth system** - Supabase Auth configured with RLS

### **Required Schema Extensions**
```sql
-- Extend existing user_subscriptions table with credit tracking
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS credits_rollover INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMPTZ DEFAULT NOW();

-- Update existing users to have default credits
UPDATE user_subscriptions 
SET credits_remaining = 50 
WHERE credits_remaining IS NULL;
```

## 💰 **Credit System Architecture**

### **Plan Structure**
| Plan | Price | Credits/Month | Rollover | Target |
|------|--------|---------------|----------|---------|
| **Trial** | Free | 50 (one-time) | 0 | New users |
| **Pro** (starter) | $15/month | 1,000 | 500 | Individuals |
| **Business** | $49/month | 5,000 | 1,000 | Teams |
| **Credit Packs** (pay_as_you_go) | $10 | 500 | ∞ | Top-ups |

### **Credit Consumption Logic**
- Each OCR operation = 1 credit
- Track consumption in existing `processing_events` table
- Use `metadata` field: `{"credits_consumed": 1, "use_case": "receipt_scanner"}`

## 🏗️ **Serverless Functions Architecture**

### **Function Structure**
```
/api/
  ├── create-checkout-session.js    # Creates Stripe payment sessions
  ├── stripe-webhook.js             # Handles payment confirmations  
  ├── ocr-process.js                # Credit-gated OCR processing
  └── utils/
      ├── supabase-client.js        # Database connection
      └── stripe-client.js          # Stripe configuration
```

### **1. Stripe Checkout Session Creation**
```javascript
// /api/create-checkout-session.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, userId } = req.body;
    
    // Get or create Stripe customer
    let customer;
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    
    if (subscription?.stripe_customer_id) {
      customer = subscription.stripe_customer_id;
    } else {
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId }
      });
      customer = stripeCustomer.id;
      
      // Save customer ID
      await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: customer })
        .eq('user_id', userId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: priceId.startsWith('price_subscription') ? 'subscription' : 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      client_reference_id: userId,
      metadata: { user_id: userId }
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### **2. Stripe Webhook Handler**
```javascript
// /api/stripe-webhook.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) return;

  const planDetails = getPlanFromSession(session);
  
  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
    plan_type: planDetails.type,
    plan_status: 'active',
    credits_remaining: planDetails.credits,
    pages_limit: planDetails.credits,
    price_amount: session.amount_total,
    currency: session.currency,
    billing_cycle_start: new Date(),
    billing_cycle_end: planDetails.type === 'pay_as_you_go' 
      ? null 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    updated_at: new Date()
  }, { onConflict: 'user_id' });
}

function getPlanFromSession(session) {
  const amount = session.amount_total;
  
  if (amount === 1500) return { type: 'starter', credits: 1000 }; // $15 Pro
  if (amount === 4900) return { type: 'business', credits: 5000 }; // $49 Business
  if (amount === 1000) return { type: 'pay_as_you_go', credits: 500 }; // $10 Credits
  
  return { type: 'trial', credits: 50 }; // Default
}
```

### **3. Credit-Gated OCR Processing**
```javascript
// /api/ocr-process.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, document, useCase } = req.body;
    
    // Check user credits
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('credits_remaining, plan_type, plan_status')
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }

    if (subscription.plan_status !== 'active') {
      return res.status(402).json({ 
        error: 'Subscription inactive',
        requiresUpgrade: true
      });
    }

    if (subscription.credits_remaining <= 0) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        creditsRemaining: 0,
        requiresUpgrade: true
      });
    }

    // Process OCR (replace with your actual OCR logic)
    const ocrResult = await processOCRDocument(document, useCase);

    // Atomic credit consumption and event logging
    const { error: updateError } = await supabase.rpc('consume_credit', {
      p_user_id: userId,
      p_use_case: useCase,
      p_credits_used: 1,
      p_value_created: calculateValueCreated(useCase),
      p_hours_saved: calculateHoursSaved(useCase)
    });

    if (updateError) {
      throw new Error('Failed to consume credit');
    }

    // Return OCR result with updated credit count
    const newBalance = subscription.credits_remaining - 1;
    
    res.status(200).json({
      success: true,
      data: ocrResult,
      creditsRemaining: newBalance,
      lowCredits: newBalance <= 10 // Trigger upgrade prompt
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({ error: error.message });
  }
}

function calculateValueCreated(useCase) {
  const valueMap = {
    'receipt_scanner': 2.50,
    'business_card': 1.00,
    'invoice_processing': 5.00,
    'form_extraction': 3.00,
    'resume_parser': 4.00
  };
  return valueMap[useCase] || 2.00;
}

function calculateHoursSaved(useCase) {
  const timeMap = {
    'receipt_scanner': 0.083, // 5 minutes
    'business_card': 0.033,  // 2 minutes  
    'invoice_processing': 0.25, // 15 minutes
    'form_extraction': 0.167,  // 10 minutes
    'resume_parser': 0.133     // 8 minutes
  };
  return timeMap[useCase] || 0.083;
}
```

## 📝 **Database Stored Procedure**
```sql
-- Create stored procedure for atomic credit consumption
CREATE OR REPLACE FUNCTION consume_credit(
  p_user_id UUID,
  p_use_case TEXT,
  p_credits_used INTEGER DEFAULT 1,
  p_value_created NUMERIC DEFAULT 2.00,
  p_hours_saved NUMERIC DEFAULT 0.083
)
RETURNS VOID AS $$
BEGIN
  -- Update subscription credits
  UPDATE user_subscriptions 
  SET 
    credits_remaining = credits_remaining - p_credits_used,
    pages_used = pages_used + p_credits_used,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log usage event
  INSERT INTO usage_tracking (
    user_id,
    pages_processed,
    document_type,
    processed_at
  ) VALUES (
    p_user_id,
    p_credits_used,
    p_use_case,
    NOW()
  );
  
  -- Log processing event for analytics
  INSERT INTO processing_events (
    user_id,
    document_type,
    processed_at,
    documents_processed_delta,
    value_created_delta,
    hours_saved_delta,
    pages_processed_delta,
    metadata
  ) VALUES (
    p_user_id,
    p_use_case,
    NOW(),
    1,
    p_value_created,
    p_hours_saved,
    p_credits_used,
    jsonb_build_object(
      'credits_consumed', p_credits_used,
      'use_case', p_use_case
    )
  );
END;
$$ LANGUAGE plpgsql;
```

## 🎨 **Frontend Integration**

### **Pricing Page Updates**
```html
<!-- Update pricing.html buttons -->
<button 
  class="btn btn-primary pricing-btn" 
  data-price-id="price_1234567890pro"
  data-plan="starter">
  Get Pro Plan - $15/month
</button>

<button 
  class="btn btn-primary pricing-btn" 
  data-price-id="price_1234567890business" 
  data-plan="business">
  Get Business Plan - $49/month
</button>

<button 
  class="btn btn-secondary pricing-btn" 
  data-price-id="price_1234567890credits"
  data-plan="pay_as_you_go">
  Buy 500 Credits - $10
</button>
```

```javascript
// Pricing page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const pricingButtons = document.querySelectorAll('.pricing-btn');
  
  pricingButtons.forEach(button => {
    button.addEventListener('click', async function() {
      const priceId = this.dataset.priceId;
      const userId = getCurrentUserId(); // Implement this
      
      try {
        this.disabled = true;
        this.textContent = 'Loading...';
        
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, userId })
        });
        
        const { url } = await response.json();
        window.location.href = url;
        
      } catch (error) {
        console.error('Payment error:', error);
        this.disabled = false;
        this.textContent = 'Try Again';
      }
    });
  });
});
```

### **Sidebar Billing Enhancement**
```javascript
// Enhanced billing sidebar
async function loadBillingInfo() {
  const userId = getCurrentUserId();
  
  const { data } = await supabase
    .from('user_subscriptions')
    .select(`
      plan_type,
      credits_remaining,
      pages_used,
      billing_cycle_end,
      plan_status,
      price_amount,
      currency
    `)
    .eq('user_id', userId)
    .single();
  
  updateBillingSidebar(data);
}

function updateBillingSidebar(subscription) {
  const sidebar = document.getElementById('billing-sidebar');
  
  sidebar.innerHTML = `
    <div class="billing-info">
      <h3>Current Plan: ${formatPlanName(subscription.plan_type)}</h3>
      
      <div class="credit-display">
        <div class="credit-bar">
          <div class="credit-progress" style="width: ${getCreditPercentage(subscription)}%"></div>
        </div>
        <p>${subscription.credits_remaining} credits remaining</p>
      </div>
      
      <div class="plan-details">
        <p>Used: ${subscription.pages_used} documents</p>
        <p>Next billing: ${formatDate(subscription.billing_cycle_end)}</p>
      </div>
      
      <div class="upgrade-buttons">
        ${generateUpgradeButtons(subscription.plan_type)}
      </div>
    </div>
  `;
}
```

### **Credit Exhaustion Modal**
```html
<!-- Credit exhaustion modal -->
<div id="credit-exhaustion-modal" class="modal hidden">
  <div class="modal-content">
    <h2>🚀 You're out of credits!</h2>
    <p>Keep the momentum going with more credits or upgrade your plan.</p>
    
    <div class="upgrade-options">
      <button class="btn btn-primary" data-price-id="price_credits">
        Buy 500 Credits - $10
      </button>
      <button class="btn btn-outline" data-price-id="price_pro">
        Upgrade to Pro - $15/month
      </button>
    </div>
    
    <div class="usage-stats">
      <p>You've already saved <span id="hours-saved">0</span> hours!</p>
      <p>Created $<span id="value-created">0</span> in value</p>
    </div>
  </div>
</div>
```

```javascript
// Credit exhaustion handling
function showCreditExhaustionModal(usageStats) {
  const modal = document.getElementById('credit-exhaustion-modal');
  
  // Populate usage stats from processing_events
  document.getElementById('hours-saved').textContent = usageStats.totalHoursSaved;
  document.getElementById('value-created').textContent = usageStats.totalValueCreated;
  
  modal.classList.remove('hidden');
  
  // Add purchase handlers
  modal.querySelectorAll('[data-price-id]').forEach(btn => {
    btn.onclick = () => purchaseCredits(btn.dataset.priceId);
  });
}

async function purchaseCredits(priceId) {
  const userId = getCurrentUserId();
  
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId })
  });
  
  const { url } = await response.json();
  window.location.href = url;
}
```

## 🔒 **Environment Variables**
```bash
# Add to .env file
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://your-app.com
```

## 📈 **Analytics Dashboard (Using Existing Data)**
```javascript
// Rich analytics from your existing processing_events table
async function loadAnalytics(userId) {
  const { data } = await supabase
    .from('processing_events')
    .select('*')
    .eq('user_id', userId)
    .order('processed_at', { ascending: false });
  
  const analytics = {
    totalDocuments: data.reduce((sum, event) => sum + event.documents_processed_delta, 0),
    totalHoursSaved: data.reduce((sum, event) => sum + event.hours_saved_delta, 0),
    totalValueCreated: data.reduce((sum, event) => sum + event.value_created_delta, 0),
    usageByType: groupBy(data, 'document_type'),
    usageTrends: calculateTrends(data)
  };
  
  return analytics;
}
```

## 🚀 **Deployment Checklist**

### **Stripe Setup**
- [ ] Create Stripe account
- [ ] Add products/prices in Stripe Dashboard
- [ ] Configure webhook endpoint
- [ ] Test with Stripe CLI
- [ ] Add production keys

### **Database Setup** 
- [ ] Run schema extension queries
- [ ] Create `consume_credit` stored procedure
- [ ] Test credit consumption logic
- [ ] Verify existing data integrity

### **Serverless Functions**
- [ ] Deploy 3 API functions
- [ ] Configure environment variables  
- [ ] Test each endpoint
- [ ] Set up error monitoring

### **Frontend Updates**
- [ ] Update pricing page buttons
- [ ] Enhance billing sidebar
- [ ] Add credit exhaustion modal
- [ ] Test full payment flow

## 🎯 **Success Metrics**
- **Payment conversion**: >8% from free to paid
- **Credit exhaustion conversion**: >15% 
- **Subscription retention**: >80% month 2
- **Support tickets**: <5% payment-related

## 🔧 **Testing Strategy**
1. **Unit Tests**: Each serverless function
2. **Integration Tests**: Full payment flow
3. **Webhook Tests**: Using Stripe CLI
4. **Load Tests**: Credit consumption under load
5. **Security Tests**: Webhook signature validation

This implementation leverages your excellent existing database structure while adding minimal complexity for maximum payment functionality!