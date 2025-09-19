# OCR Packages Stripe Integration - Implementation Plan

## Executive Summary

Transform the current inefficient payment flow and integrate with the new OCR Packages Stripe catalog while implementing automated credit management system.

**Current Problems:**
- Broken price ID mappings (all billing buttons use same price ID)
- Inefficient 5-step user flow: pricing → login → dashboard → billing → payment
- Basic plan uses direct Stripe link from deleted catalog
- No automated credit allocation system
- Missing session persistence across authentication

**Target Solution:**
- Streamlined 3-step flow: pricing → login → payment
- Proper OCR Packages price ID mapping
- Automated credit management in Supabase
- Direct payment routing with session persistence

---

## PHASE 1: DISCOVERY & AUDIT (Days 1-2)

### Current State Analysis Completed ✅

**Frontend Price ID Issues Identified:**

**pricing.html:**
```javascript
// Current placeholder/broken price IDs:
Free Plan: "free_plan"
Basic Plan: "price_starter_monthly" + direct link
Vision Pro+: "price_business_monthly"
Vision Max: "price_enterprise_monthly"
Quick Scan: "price_credits_quick_scan"
Power Pack: "price_credits_power_pack"
Professional: "price_credits_professional"
Enterprise Credits: "price_credits_enterprise"
```

**index.html (Billing Section):**
```javascript
// CRITICAL BUG: All buttons use same price ID
Basic Plan: "price_1S5BKbERMwo4L7iya2m4M7xZ"
Vision Pro+: "price_1S5BKbERMwo4L7iya2m4M7xZ"  // ❌ Same ID
Vision Max: "price_1S5BKbERMwo4L7iya2m4M7xZ"   // ❌ Same ID
All Credit Packs: "price_1S5BKbERMwo4L7iya2m4M7xZ" // ❌ Same ID
```

### Tasks Remaining:

#### 1.1 Stripe OCR Packages Audit
- [ ] Access Stripe Dashboard → Products → OCR Packages
- [ ] Extract all subscription price IDs:
  - Basic Plan ($14.99/month)
  - Vision Pro+ ($49.99/month)
  - Vision Max ($129.99/month)
- [ ] Extract all credit pack price IDs:
  - Quick Scan ($9.99 - 50 credits)
  - Power Pack ($39.99 - 250 credits)
  - Professional ($89.99 - 600 credits)
  - Enterprise ($129.99 - 1000 credits)

#### 1.2 Credit Amount Mapping
- [ ] Define credit amounts per plan:
  - Basic Plan: 100 credits/month
  - Vision Pro+: 500 credits/month
  - Vision Max: 2000 credits/month
  - Credit packs: As listed above

#### 1.3 User Journey Analysis
- [ ] Document broken Basic plan integration
- [ ] Map current vs target authentication flows
- [ ] Identify session persistence requirements

**Deliverables:**
- [ ] Price ID mapping spreadsheet
- [ ] Credit allocation specification
- [ ] User flow diagram (current vs target)

---

## PHASE 2: BACKEND INFRASTRUCTURE (Days 3-5)

### 2.1 Supabase Credits Schema

```sql
-- Create credits transactions table
CREATE TABLE credits_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    stripe_event_id TEXT UNIQUE NOT NULL,
    stripe_payment_id TEXT UNIQUE,
    delta INTEGER NOT NULL, -- positive for credits, negative for refunds
    reason TEXT NOT NULL, -- 'basic_plan_monthly', 'quick_scan_purchase', 'refund', etc.
    plan_type TEXT, -- 'basic', 'vision_pro', 'vision_max', 'credits'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast user lookups
CREATE INDEX idx_credits_transactions_user_id ON credits_transactions(user_id);
CREATE INDEX idx_credits_transactions_stripe_event ON credits_transactions(stripe_event_id);

-- Row Level Security
ALTER TABLE credits_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions" ON credits_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Materialized view for credit balances (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW credits_balance_mv AS
SELECT
    user_id,
    SUM(delta) as balance,
    COUNT(*) as transaction_count,
    MAX(created_at) as last_transaction
FROM credits_transactions
GROUP BY user_id;

CREATE UNIQUE INDEX idx_credits_balance_user ON credits_balance_mv(user_id);

-- Function to refresh balance view
CREATE OR REPLACE FUNCTION refresh_credits_balance()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY credits_balance_mv;
END;
$$ LANGUAGE plpgsql;

-- Create user credits helper function
CREATE OR REPLACE FUNCTION get_user_credit_balance(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(delta), 0)
    INTO balance
    FROM credits_transactions
    WHERE user_id = target_user_id;

    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Stripe Webhook Infrastructure

```javascript
// /api/stripe/webhook endpoint structure
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log raw event for auditing
    await supabase
        .from('stripe_events_raw')
        .insert({
            event_id: event.id,
            event_type: event.type,
            event_data: event,
            processed: false
        });

    // Process event
    try {
        await processStripeEvent(event);
        res.json({received: true});
    } catch (error) {
        console.error('Event processing failed:', error);
        res.status(500).json({error: 'Event processing failed'});
    }
});
```

### 2.3 Credit Allocation Service

```javascript
async function processStripeEvent(event) {
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object);
            break;
        case 'invoice.paid':
            await handleInvoicePaid(event.data.object);
            break;
        case 'charge.refunded':
            await handleRefund(event.data.object);
            break;
    }
}

async function allocateCredits(userId, priceId, stripeEventId, stripePaymentId) {
    const creditMapping = {
        // Subscription plans (monthly credits)
        'price_BASIC_MONTHLY': { credits: 100, reason: 'basic_plan_monthly', plan_type: 'basic' },
        'price_PRO_MONTHLY': { credits: 500, reason: 'vision_pro_monthly', plan_type: 'vision_pro' },
        'price_MAX_MONTHLY': { credits: 2000, reason: 'vision_max_monthly', plan_type: 'vision_max' },

        // Credit packs (one-time purchases)
        'price_QUICK_SCAN': { credits: 50, reason: 'quick_scan_purchase', plan_type: 'credits' },
        'price_POWER_PACK': { credits: 250, reason: 'power_pack_purchase', plan_type: 'credits' },
        'price_PROFESSIONAL': { credits: 600, reason: 'professional_purchase', plan_type: 'credits' },
        'price_ENTERPRISE': { credits: 1000, reason: 'enterprise_purchase', plan_type: 'credits' }
    };

    const allocation = creditMapping[priceId];
    if (!allocation) {
        throw new Error(`Unknown price ID: ${priceId}`);
    }

    // Idempotent credit allocation
    const { error } = await supabase
        .from('credits_transactions')
        .insert({
            user_id: userId,
            stripe_event_id: stripeEventId,
            stripe_payment_id: stripePaymentId,
            delta: allocation.credits,
            reason: allocation.reason,
            plan_type: allocation.plan_type
        });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
        throw error;
    }
}
```

### 2.4 Session Management System

```javascript
// JWT-based plan persistence
function createPlanSession(priceId, planType) {
    const payload = {
        priceId,
        planType,
        timestamp: Date.now(),
        expires: Date.now() + (15 * 60 * 1000) // 15 minutes
    };

    return jwt.sign(payload, process.env.JWT_SECRET);
}

function extractPlanSession(token) {
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.expires < Date.now()) {
            return null; // Expired
        }
        return { priceId: payload.priceId, planType: payload.planType };
    } catch {
        return null;
    }
}
```

**Phase 2 Deliverables:**
- [ ] Supabase migration files for credits schema
- [ ] Webhook endpoint with signature verification
- [ ] Credit allocation service with unit tests
- [ ] Session management utilities

---

## PHASE 3: PAYMENT FLOW OPTIMIZATION (Days 6-8)

### 3.1 Enhanced createCheckoutSession()

```javascript
// Updated app.js function
async function createCheckoutSession(priceId, planType, userId) {
    try {
        const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: priceId,
                userId: userId,
                planType: planType,
                successUrl: `${window.location.origin}/index.html?success=true&plan=${planType}`,
                cancelUrl: `${window.location.origin}/pricing.html?canceled=true`
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create checkout session');
        }

        const { url } = await response.json();
        window.location.href = url;

    } catch (error) {
        console.error('Checkout session error:', error);
        showNotification('Failed to create payment session. Please try again.', 'error');
    }
}
```

### 3.2 Authentication Flow Enhancement

```javascript
// Enhanced pricing.html button handler
async function handlePricingButtonClick(event) {
    event.preventDefault();

    const button = event.target.closest('.pricing-btn');
    const priceId = button.dataset.priceId;
    const planType = button.dataset.plan;

    if (planType === 'free') {
        // Direct signup for free plan
        window.location.href = `./index.html?plan=free`;
        return;
    }

    // Create session token and redirect to login
    const sessionToken = await createPlanSessionToken(priceId, planType);
    setCookie('plan_session', sessionToken, 15); // 15 minutes
    window.location.href = `./index.html?intent=payment&plan=${planType}`;
}

// Enhanced login success handler in index.html
async function onLoginSuccess(user) {
    const urlParams = new URLSearchParams(window.location.search);
    const intent = urlParams.get('intent');

    if (intent === 'payment') {
        const planSession = getCookie('plan_session');
        if (planSession) {
            const { priceId, planType } = extractPlanSession(planSession);
            if (priceId && planType) {
                // Clear session cookie
                deleteCookie('plan_session');
                // Direct to payment
                await createCheckoutSession(priceId, planType, user.id);
                return;
            }
        }
    }

    // Default behavior - go to dashboard
    showDashboard();
}
```

### 3.3 Post-Payment Routing

```javascript
// Enhanced return URL handling
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('success')) {
        const plan = urlParams.get('plan');
        showNotification(`Welcome to ${plan} plan! Your credits have been added.`, 'success');

        // Refresh user data and show relevant page
        if (plan === 'free') {
            showDashboard();
        } else {
            showBillingPage(); // Show billing to confirm new plan
        }
    } else if (urlParams.get('canceled')) {
        showNotification('Payment was canceled. You can try again anytime.', 'info');
    }
});
```

**Phase 3 Deliverables:**
- [ ] Updated payment session creation logic
- [ ] Authentication flow with plan persistence
- [ ] Post-payment routing system
- [ ] Cookie-based session management

---

## PHASE 4: FRONTEND INTEGRATION (Days 9-11)

### 4.1 Pricing Page Updates

**File: pricing.html**

```html
<!-- Updated buttons with real OCR Packages price IDs -->

<!-- Basic Plan -->
<button
    class="pricing-btn w-full flex items-center justify-center px-8 py-4 text-[#101820] bg-[#FEE715] rounded-xl hover:bg-[#FFD700] transition-all duration-300 font-bold"
    data-price-id="price_ACTUAL_BASIC_ID_FROM_STRIPE"
    data-plan="basic"
    data-credits="100">
    Choose Basic Plan
</button>

<!-- Vision Pro+ Plan -->
<button
    class="pricing-btn w-full block text-center px-6 py-4 text-[#101820] bg-[#FEE715] rounded-xl hover:bg-[#FFD700] transition-all duration-300 font-bold"
    data-price-id="price_ACTUAL_PRO_ID_FROM_STRIPE"
    data-plan="vision_pro"
    data-credits="500">
    Choose Vision Pro+
</button>

<!-- Credit Packs -->
<button
    class="pricing-btn w-full text-center px-6 py-3 text-[#101820] bg-[#FEE715] rounded-xl hover:bg-[#FFD700] transition-all duration-300 font-semibold"
    data-price-id="price_ACTUAL_QUICKSCAN_ID_FROM_STRIPE"
    data-plan="credits"
    data-credits="50">
    Purchase Credits
</button>
```

### 4.2 Billing Page Integration

**File: index.html (billing section)**

```html
<!-- Fixed: Each button has unique price ID -->

<!-- Basic Plan -->
<button class="btn-pkg btn-pkg--primary"
        data-price-id="price_ACTUAL_BASIC_ID_FROM_STRIPE"
        data-plan="basic">Upgrade to Basic</button>

<!-- Vision Pro+ Plan -->
<button class="btn-pkg btn-pkg--secondary"
        data-price-id="price_ACTUAL_PRO_ID_FROM_STRIPE"
        data-plan="vision_pro">Upgrade to Vision Pro+</button>

<!-- Vision Max Plan -->
<button class="btn-pkg btn-pkg--secondary"
        data-price-id="price_ACTUAL_MAX_ID_FROM_STRIPE"
        data-plan="vision_max">Upgrade to Vision Max</button>

<!-- Credit Packs - Each with unique price ID -->
<button class="btn-pkg btn-pkg--secondary"
        data-price-id="price_ACTUAL_QUICKSCAN_ID_FROM_STRIPE"
        data-plan="credits">Purchase Quick Scan</button>
```

### 4.3 Dynamic Configuration System

**File: price-config.json**

```json
{
  "subscriptions": {
    "basic": {
      "priceId": "price_ACTUAL_BASIC_ID_FROM_STRIPE",
      "credits": 100,
      "price": "$14.99/month"
    },
    "vision_pro": {
      "priceId": "price_ACTUAL_PRO_ID_FROM_STRIPE",
      "credits": 500,
      "price": "$49.99/month"
    },
    "vision_max": {
      "priceId": "price_ACTUAL_MAX_ID_FROM_STRIPE",
      "credits": 2000,
      "price": "$129.99/month"
    }
  },
  "creditPacks": {
    "quick_scan": {
      "priceId": "price_ACTUAL_QUICKSCAN_ID_FROM_STRIPE",
      "credits": 50,
      "price": "$9.99"
    },
    "power_pack": {
      "priceId": "price_ACTUAL_POWERPACK_ID_FROM_STRIPE",
      "credits": 250,
      "price": "$39.99"
    },
    "professional": {
      "priceId": "price_ACTUAL_PROFESSIONAL_ID_FROM_STRIPE",
      "credits": 600,
      "price": "$89.99"
    },
    "enterprise": {
      "priceId": "price_ACTUAL_ENTERPRISE_ID_FROM_STRIPE",
      "credits": 1000,
      "price": "$129.99"
    }
  }
}
```

### 4.4 Enhanced Button Handlers

```javascript
// Updated app.js - billing page handlers
document.addEventListener('click', async function(e) {
    if (e.target.closest('.btn-pkg')) {
        const button = e.target.closest('.btn-pkg');
        const priceId = button.dataset.priceId;
        const planType = button.dataset.plan;

        if (!currentUser) {
            showNotification('Please log in to upgrade your plan', 'error');
            return;
        }

        // Show loading state
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            await createCheckoutSession(priceId, planType, currentUser.id);
        } catch (error) {
            button.disabled = false;
            button.textContent = 'Upgrade Plan'; // Reset text
            showNotification('Failed to start payment process', 'error');
        }
    }
});
```

**Phase 4 Deliverables:**
- [ ] Updated pricing.html with correct price IDs
- [ ] Fixed billing page with unique price IDs
- [ ] Dynamic price configuration system
- [ ] Enhanced button click handlers

---

## PHASE 5: TESTING & VALIDATION (Days 12-14)

### 5.1 Testing Matrix

#### Payment Flow Testing
- [ ] **Free Plan Signup**
  - Click "Start Free" → redirects to index.html?plan=free
  - Login/signup → goes to dashboard
  - No payment required

- [ ] **Basic Plan Purchase**
  - Click "Choose Basic Plan" → sets session → redirects to login
  - After login → direct to Stripe checkout
  - Payment success → credits added → user redirected to billing page

- [ ] **Subscription Plans**
  - Test Vision Pro+ and Vision Max flows
  - Verify monthly recurring billing
  - Test plan upgrades/downgrades

- [ ] **Credit Packs**
  - Test all 4 credit pack purchases
  - Verify one-time payment processing
  - Confirm credits added immediately

#### Credit System Testing
- [ ] **Credit Allocation**
  - Subscription: 100/500/2000 credits added monthly
  - Credit packs: 50/250/600/1000 credits added immediately
  - Verify credit balance updates in UI

- [ ] **Webhook Processing**
  - Test payment.succeeded events
  - Test invoice.paid events
  - Test refund scenarios
  - Verify idempotency (no double credits)

#### Error Handling Testing
- [ ] **Payment Failures**
  - Declined cards → proper error messages
  - Canceled payments → return to pricing with message
  - Network failures → graceful degradation

- [ ] **Session Management**
  - Expired session tokens → fallback to login
  - Cross-device/browser scenarios
  - Plan session persistence through login

#### Security Testing
- [ ] **Webhook Security**
  - Stripe signature verification
  - Invalid webhook payloads
  - Replay attack prevention

- [ ] **User Authorization**
  - Only authenticated users can purchase
  - Users can only see their own credits
  - Proper RLS on credits table

### 5.2 Performance Testing
- [ ] Webhook response time < 200ms
- [ ] Credit balance queries optimized
- [ ] UI loading states during checkout

### 5.3 Production Deployment Checklist
- [ ] All price IDs verified in Stripe dashboard
- [ ] Webhook endpoint configured in Stripe
- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] RLS policies tested
- [ ] Error monitoring configured

**Phase 5 Deliverables:**
- [ ] Comprehensive test results
- [ ] Performance benchmarks
- [ ] Production deployment guide
- [ ] Monitoring and alerting setup

---

## Technical Architecture

### Security & Reliability
- **Webhook Security**: Stripe signature verification mandatory
- **Session Security**: JWT encryption for cross-domain state transfer
- **Database Security**: Row-level security on credits table
- **Idempotency**: Prevent duplicate credit allocation via unique constraints

### Performance Optimization
- **Webhook Response**: < 200ms response time requirement
- **Credit Queries**: Materialized views for fast balance lookups
- **Session Management**: Cookie-based with secure flags
- **Error Handling**: Graceful degradation with retry mechanisms

### Monitoring & Observability
- **Payment Metrics**: Success/failure rates per plan
- **Credit Auditing**: Full transaction log with stripe event tracking
- **User Journey**: Conversion tracking from pricing to payment
- **Error Tracking**: Webhook failures and payment errors

---

## Risk Mitigation Strategy

### High Priority Risks

1. **Double Credit Allocation**
   - **Risk**: Webhook replay causing duplicate credits
   - **Mitigation**: Unique constraints on stripe_event_id + stripe_payment_id
   - **Testing**: Replay same webhook multiple times

2. **Cross-Domain Session Loss**
   - **Risk**: Plan selection lost during login redirect
   - **Mitigation**: Encrypted JWT cookies with domain scope
   - **Testing**: Cross-device and cross-browser scenarios

3. **Price ID Mismatches**
   - **Risk**: Frontend uses wrong Stripe price IDs
   - **Mitigation**: Configuration-driven pricing + validation
   - **Testing**: Automated price ID validation in CI

4. **Webhook Delivery Failures**
   - **Risk**: Stripe events not processed, credits not allocated
   - **Mitigation**: Retry queue + 2XX response requirement
   - **Testing**: Simulate webhook endpoint downtime

### Medium Priority Risks

5. **Plan Upgrade/Downgrade Logic**
   - **Risk**: Complex subscription changes affecting credits
   - **Mitigation**: Clear credit transfer policies
   - **Testing**: All upgrade/downgrade scenarios

6. **Refund Handling**
   - **Risk**: Credits not properly reversed on refunds
   - **Mitigation**: Negative transaction system
   - **Testing**: Partial and full refund scenarios

---

## Success Metrics

### Conversion Metrics
- **Payment Completion Rate**: Target >85% (pricing → payment success)
- **User Flow Efficiency**: 3-step vs 5-step flow comparison
- **Plan Selection Accuracy**: Correct plan activated >99%

### Technical Metrics
- **Credit Allocation Accuracy**: 100% accurate credit delivery
- **Webhook Processing**: <1% failure rate
- **Payment Error Rate**: <2% technical failures

### User Experience Metrics
- **Time to Payment**: <2 minutes from plan selection
- **Session Persistence**: >95% successful plan transfers
- **Error Recovery**: Clear messaging and retry options

---

## Implementation Timeline

| Phase | Duration | Key Milestones | Dependencies |
|-------|----------|----------------|--------------|
| Phase 1 | 2 days | Price ID mapping completed | Stripe dashboard access |
| Phase 2 | 3 days | Credits schema + webhook deployed | Supabase access |
| Phase 3 | 3 days | Payment flow optimization | Phase 2 complete |
| Phase 4 | 3 days | Frontend integration | Phase 3 complete |
| Phase 5 | 3 days | Testing & deployment | All phases complete |

**Total Duration: 14 days**

---

## Next Steps

### Immediate Actions (Start Today)
1. **Access Stripe Dashboard** → Extract actual OCR Packages price IDs
2. **Create price-config.json** with real Stripe price IDs
3. **Start Supabase migration** for credits schema
4. **Document current vs target user flows**

### Week 1 Focus
- Complete Phase 1 & 2 (Infrastructure setup)
- Test webhook endpoint with Stripe test events
- Validate credit allocation logic

### Week 2 Focus
- Complete Phase 3 & 4 (Payment flow + Frontend)
- Comprehensive testing in Stripe test mode
- Production deployment preparation

---

*This plan provides a systematic approach to modernizing the payment infrastructure while maintaining reliability and optimizing user experience. Each phase builds upon the previous one, with clear deliverables and success criteria.*