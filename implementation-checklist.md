# OCR Packages Integration - Implementation Checklist

**Status**: Planning Complete ✅ | Implementation Ready 🚀

This checklist provides step-by-step implementation instructions following the 5-phase plan.

---

## 🚀 Quick Start Implementation Guide

### Prerequisites Verification
- [ ] Stripe account with OCR Packages product created
- [ ] Supabase project with auth enabled
- [ ] Node.js backend with Express/Vercel setup
- [ ] Frontend with existing authentication flow

---

## Phase 1: Extract Real Price IDs (15 mins)

### 1.1 Get Stripe Price IDs
- [ ] Go to [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
- [ ] Find "OCR Packages" product
- [ ] Extract all price IDs (format: `price_xxxxxxxxxxxxx`)

**Expected Structure:**
```
Subscriptions:
- Basic Plan ($14.99/month): price________________
- Vision Pro+ ($49.99/month): price________________
- Vision Max ($129.99/month): price________________

Credit Packs:
- Quick Scan ($9.99 - 50 credits): price________________
- Power Pack ($39.99 - 250 credits): price________________
- Professional ($89.99 - 600 credits): price________________
- Enterprise ($129.99 - 1000 credits): price________________
```

### 1.2 Update Configuration
- [ ] Update `price-config.json` with real price IDs
- [ ] Remove placeholder `REPLACE_WITH_ACTUAL_` values
- [ ] Validate JSON structure

---

## Phase 2: Deploy Backend Infrastructure (30 mins)

### 2.1 Supabase Migration
```bash
# Apply the credits system migration
supabase db push
# OR manually run the SQL in Supabase dashboard
```
- [ ] Run `migrations/001_create_credits_system.sql`
- [ ] Verify tables created: `credits_transactions`, `stripe_events_raw`
- [ ] Test function: `SELECT test_credits_system();`

### 2.2 Webhook Endpoint
- [ ] Deploy `api/stripe/webhook.js` to your backend
- [ ] Update CREDIT_MAPPING with real price IDs
- [ ] Test webhook endpoint responds to POST requests

### 2.3 Stripe Webhook Configuration
- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Add endpoint: `https://yourdomain.com/api/stripe/webhook`
- [ ] Select events: `checkout.session.completed`, `invoice.payment_succeeded`
- [ ] Copy webhook signing secret to environment variables

---

## Phase 3: Update Payment Flow (20 mins)

### 3.1 Enhanced Checkout Function
- [ ] Replace `createCheckoutSession()` in your frontend JS
- [ ] Update with new validation and error handling
- [ ] Test price ID validation logic

### 3.2 Session Persistence
- [ ] Implement JWT session management
- [ ] Add session restoration after payment
- [ ] Test cross-domain cookie handling

---

## Phase 4: Frontend Integration (25 mins)

### 4.1 Pricing Page Updates
- [ ] Update all button `data-price-id` attributes with real IDs
- [ ] Remove hardcoded Stripe checkout link
- [ ] Test all plan buttons trigger correct checkout sessions

### 4.2 Billing Page Fix
- [ ] Verify billing page loads correct plans for each user
- [ ] Test credit pack purchases don't interfere with subscriptions
- [ ] Validate credit balance displays correctly

---

## Phase 5: Testing & Validation (45 mins)

### 5.1 Test Mode Validation
Run each test case from `Phase-5-Testing-Validation.md`:

**Critical Test Cases:**
- [ ] All 7 price IDs create valid checkout sessions
- [ ] Webhook processes payments and allocates credits
- [ ] Credit balance updates in real-time
- [ ] Error handling works for invalid payments
- [ ] Session persistence across authentication

### 5.2 Production Readiness
- [ ] Switch Stripe to live mode
- [ ] Update webhook endpoint to production URL
- [ ] Test with real payment method
- [ ] Monitor error logs

---

## 🔧 Environment Variables Checklist

**Required Variables:**
```env
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App
JWT_SECRET=your-jwt-secret-key
DOMAIN=yourdomain.com
```

---

## 🚨 Common Implementation Issues

### Issue: Price ID Not Found
**Symptoms:** "No such price" error in Stripe
**Solution:** Double-check price ID format and Stripe account

### Issue: Webhook Not Triggered
**Symptoms:** Credits not allocated after payment
**Solution:** Verify webhook URL and event selection in Stripe

### Issue: CORS Errors
**Symptoms:** Checkout session creation fails
**Solution:** Add proper CORS headers to API endpoints

### Issue: Credit Balance Not Updating
**Symptoms:** UI shows old balance after payment
**Solution:** Check materialized view refresh and RLS policies

---

## 📊 Success Metrics

**Immediate Validation (< 2 hours):**
- [ ] All payment buttons work in test mode
- [ ] Credits allocated correctly for each plan type
- [ ] Error handling prevents payment failures
- [ ] User flow reduced from 5 steps to 3 steps

**Performance Targets (< 1 week):**
- [ ] Checkout session creation: < 2 seconds
- [ ] Credit balance lookup: < 500ms
- [ ] Webhook processing: < 5 seconds
- [ ] Payment success rate: > 95%

---

## 🔄 Rollback Plan

If issues occur during implementation:

1. **Frontend Rollback:** Restore original button links
2. **Backend Rollback:** Disable webhook endpoint
3. **Database Rollback:** Drop new tables if needed
4. **Stripe Rollback:** Remove webhook configuration

**Emergency Commands:**
```sql
-- Rollback database changes
DROP TABLE IF EXISTS credits_transactions CASCADE;
DROP TABLE IF EXISTS stripe_events_raw CASCADE;
DROP MATERIALIZED VIEW IF EXISTS credits_balance_mv CASCADE;
```

---

## 📞 Support Resources

- **Stripe Documentation:** https://stripe.com/docs/checkout
- **Supabase RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **Phase Documentation:** `Phase-1-` through `Phase-5-` files
- **Troubleshooting:** `stripe-price-id-template.md`

---

## ✅ Implementation Complete Checklist

**Functional Requirements:**
- [ ] Direct payment from pricing page (3-step flow)
- [ ] Automatic credit allocation for all plan types
- [ ] Session persistence across authentication
- [ ] Real-time credit balance updates
- [ ] Error handling and user feedback

**Technical Requirements:**
- [ ] Webhook signature verification
- [ ] Idempotent payment processing
- [ ] RLS security policies
- [ ] Performance optimization (materialized views)
- [ ] Comprehensive error logging

**User Experience:**
- [ ] Seamless payment flow
- [ ] Clear credit balance visibility
- [ ] Intuitive plan selection
- [ ] Responsive error messages
- [ ] Mobile-friendly interface

---

**Next Step:** Start with Phase 1 - Extract your real Stripe price IDs and update the configuration files! 🚀