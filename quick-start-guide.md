# OCR Packages Integration - Quick Start Guide

**🎯 Goal**: Connect Stripe OCR Packages to your dashboard with automated credit allocation

**⏱️ Time**: 90 minutes total implementation

---

## 🚀 30-Second Overview

You're upgrading from:
- ❌ **5-step flow**: pricing → login → dashboard → billing → payment
- ❌ **Broken mappings**: all buttons use same price ID
- ❌ **Manual credits**: no automatic allocation

To:
- ✅ **3-step flow**: pricing → login → payment
- ✅ **Dynamic pricing**: each button uses correct price ID
- ✅ **Auto credits**: instant allocation via webhooks

---

## 📋 Pre-Implementation Checklist (5 mins)

**Verify You Have:**
- [ ] Stripe account with "OCR Packages" product created
- [ ] 7 price IDs created (3 subscriptions + 4 credit packs)
- [ ] Supabase project with authentication enabled
- [ ] Backend API capable of handling webhooks
- [ ] Environment variables configured

**Files You'll Modify:**
- [ ] `price-config.json` ← Update with real price IDs
- [ ] `api/stripe/webhook.js` ← Credit allocation logic
- [ ] Frontend checkout functions ← Enhanced validation
- [ ] Supabase schema ← Credits system tables

---

## ⚡ Speed Implementation (90 mins)

### Step 1: Extract Price IDs (15 mins)
```bash
# 1. Go to dashboard.stripe.com/products
# 2. Find "OCR Packages"
# 3. Copy all 7 price IDs (start with "price_")
# 4. Update price-config.json
```

### Step 2: Deploy Backend (30 mins)
```sql
-- Run this in Supabase SQL Editor:
-- Copy content from migrations/001_create_credits_system.sql
```

```javascript
// Deploy api/stripe/webhook.js with your price IDs
const CREDIT_MAPPING = {
    'price_YOUR_BASIC_ID': { credits: 100, reason: 'basic_plan_monthly', plan_type: 'basic' },
    'price_YOUR_PRO_ID': { credits: 500, reason: 'vision_pro_monthly', plan_type: 'vision_pro' },
    // ... add all 7 mappings
};
```

### Step 3: Configure Stripe Webhook (10 mins)
```bash
# 1. Stripe Dashboard → Webhooks → Add endpoint
# 2. URL: https://yourdomain.com/api/stripe/webhook
# 3. Events: checkout.session.completed, invoice.payment_succeeded
# 4. Copy webhook secret to environment variables
```

### Step 4: Update Frontend (20 mins)
```javascript
// Replace createCheckoutSession() function
// Update all button data-price-id attributes
// Remove hardcoded Stripe links
```

### Step 5: Test Everything (15 mins)
```bash
# Test each plan type:
# 1. Basic subscription → Should get 100 credits monthly
# 2. Quick Scan credit pack → Should get 50 credits immediately
# 3. Verify webhook processes payments
# 4. Check credit balance updates in real-time
```

---

## 🎛️ Critical Configuration

**Environment Variables:**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Price ID Mapping Template:**
```json
{
  "subscriptions": {
    "basic": { "priceId": "price_YOUR_BASIC_MONTHLY_ID" },
    "vision_pro": { "priceId": "price_YOUR_PRO_MONTHLY_ID" },
    "vision_max": { "priceId": "price_YOUR_MAX_MONTHLY_ID" }
  },
  "creditPacks": {
    "quick_scan": { "priceId": "price_YOUR_QUICKSCAN_ID" },
    "power_pack": { "priceId": "price_YOUR_POWERPACK_ID" },
    "professional": { "priceId": "price_YOUR_PROFESSIONAL_ID" },
    "enterprise": { "priceId": "price_YOUR_ENTERPRISE_ID" }
  }
}
```

---

## 🧪 Instant Validation Tests

**Test 1: Price ID Validation**
```javascript
// Should create checkout session without errors
createCheckoutSession('price_YOUR_BASIC_ID', 'basic');
```

**Test 2: Webhook Processing**
```bash
# Complete a test payment → Check Supabase credits_transactions table
# Should see new row with correct credit delta
```

**Test 3: Credit Balance**
```javascript
// After payment, user credit balance should update immediately
// Check materialized view: credits_balance_mv
```

**Test 4: Error Handling**
```javascript
// Invalid price ID should show user-friendly error
createCheckoutSession('invalid_price', 'basic');
```

---

## 🚨 Troubleshooting Quick Fixes

**❌ "No such price" Error**
→ Double-check price ID format (`price_` prefix required)

**❌ Webhook Not Firing**
→ Verify webhook URL and event selection in Stripe Dashboard

**❌ Credits Not Added**
→ Check webhook signing secret and CREDIT_MAPPING

**❌ CORS Errors**
→ Add CORS headers to webhook endpoint

**❌ Authentication Issues**
→ Verify Supabase service role key permissions

---

## 📈 Expected Results

**Before Implementation:**
- All payment buttons redirect to same Stripe page
- Manual credit allocation required
- 5-step user flow
- No payment tracking

**After Implementation:**
- Each button creates correct checkout session
- Automatic credit allocation via webhooks
- 3-step user flow
- Complete payment audit trail
- Real-time credit balance updates

---

## 🔄 Rollback Plan (If Needed)

**Frontend Rollback:**
```javascript
// Restore original hardcoded Stripe links
<a href="https://buy.stripe.com/test_ORIGINAL_LINK">Choose Plan</a>
```

**Backend Rollback:**
```sql
-- Remove new tables if needed
DROP TABLE credits_transactions CASCADE;
```

**Stripe Rollback:**
```bash
# Remove webhook configuration from Stripe Dashboard
```

---

## 📚 Detailed Documentation References

- **Complete Implementation Plan:** `OCR-Packages-Integration-Plan.md`
- **Phase-by-Phase Details:** `Phase-1-` through `Phase-5-` files
- **Testing Matrix:** `Phase-5-Testing-Validation.md`
- **Troubleshooting Guide:** `stripe-price-id-template.md`
- **Implementation Checklist:** `implementation-checklist.md`

---

**🚀 Ready to Start?** Begin with Step 1: Extract your Stripe price IDs and update `price-config.json`!