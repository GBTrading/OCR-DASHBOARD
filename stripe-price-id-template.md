# Stripe Price ID Extraction Template

**Purpose**: Extract real price IDs from your Stripe OCR Packages product to replace placeholders

---

## 🔍 How to Extract Price IDs from Stripe Dashboard

### Step 1: Access Stripe Dashboard
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Ensure you're in **Test Mode** (for now)
3. Navigate to **Products** in the left sidebar

### Step 2: Find OCR Packages Product
1. Look for your **"OCR Packages"** product
2. Click on the product name to view details
3. You should see all the prices you've created

### Step 3: Extract Price IDs
For each price, copy the **Price ID** (starts with `price_`)

**Expected Price Structure:**

#### Subscription Plans:
- **Basic Plan** ($14.99/month): `price_________________`
- **Vision Pro+** ($49.99/month): `price_________________`
- **Vision Max** ($129.99/month): `price_________________`

#### Credit Packs:
- **Quick Scan** ($9.99 - 50 credits): `price_________________`
- **Power Pack** ($39.99 - 250 credits): `price_________________`
- **Professional** ($89.99 - 600 credits): `price_________________`
- **Enterprise** ($129.99 - 1000 credits): `price_________________`

---

## 📝 Price ID Replacement Checklist

Once you have the real price IDs, update these files:

### 1. Update `price-config.json`
Replace these placeholders:
```json
{
  "subscriptions": {
    "basic": {
      "priceId": "price_REPLACE_WITH_ACTUAL_BASIC_MONTHLY_ID",
      // ↑ Replace with real Basic plan price ID
    },
    "vision_pro": {
      "priceId": "price_REPLACE_WITH_ACTUAL_PRO_MONTHLY_ID",
      // ↑ Replace with real Vision Pro+ price ID
    },
    "vision_max": {
      "priceId": "price_REPLACE_WITH_ACTUAL_MAX_MONTHLY_ID",
      // ↑ Replace with real Vision Max price ID
    }
  },
  "creditPacks": {
    "quick_scan": {
      "priceId": "price_REPLACE_WITH_ACTUAL_QUICKSCAN_ID",
      // ↑ Replace with real Quick Scan price ID
    },
    "power_pack": {
      "priceId": "price_REPLACE_WITH_ACTUAL_POWERPACK_ID",
      // ↑ Replace with real Power Pack price ID
    },
    "professional": {
      "priceId": "price_REPLACE_WITH_ACTUAL_PROFESSIONAL_ID",
      // ↑ Replace with real Professional price ID
    },
    "enterprise": {
      "priceId": "price_REPLACE_WITH_ACTUAL_ENTERPRISE_ID",
      // ↑ Replace with real Enterprise price ID
    }
  }
}
```

### 2. Update Backend Credit Mapping
In your webhook handler (`api/stripe/webhook.js`), update:
```javascript
const CREDIT_MAPPING = {
    // Replace these with real price IDs:
    'price_ACTUAL_BASIC_MONTHLY_ID': { credits: 100, reason: 'basic_plan_monthly', plan_type: 'basic' },
    'price_ACTUAL_PRO_MONTHLY_ID': { credits: 500, reason: 'vision_pro_monthly', plan_type: 'vision_pro' },
    'price_ACTUAL_MAX_MONTHLY_ID': { credits: 2000, reason: 'vision_max_monthly', plan_type: 'vision_max' },
    'price_ACTUAL_QUICKSCAN_ID': { credits: 50, reason: 'quick_scan_purchase', plan_type: 'credits' },
    'price_ACTUAL_POWERPACK_ID': { credits: 250, reason: 'power_pack_purchase', plan_type: 'credits' },
    'price_ACTUAL_PROFESSIONAL_ID': { credits: 600, reason: 'professional_purchase', plan_type: 'credits' },
    'price_ACTUAL_ENTERPRISE_ID': { credits: 1000, reason: 'enterprise_purchase', plan_type: 'credits' }
};
```

### 3. Remove Direct Stripe Link
In `pricing.html`, remove this broken link:
```html
<!-- REMOVE THIS BROKEN LINK: -->
<a href="https://buy.stripe.com/test_cNi3cv4BJbDE8Fg4Vh6wE00"
   target="_blank"
   class="pricing-btn w-full flex items-center justify-center px-8 py-4 text-[#101820] bg-[#FEE715] rounded-xl hover:bg-[#FFD700] transition-all duration-300 font-bold shadow-lg hover:shadow-[#FEE715]/25 transform hover:scale-105 disabled:opacity-50 whitespace-nowrap">
   Choose Basic Plan
</a>

<!-- REPLACE WITH BUTTON (already done in Phase 4): -->
<button class="pricing-btn ..." data-price-id="REAL_BASIC_PRICE_ID" data-plan="basic">
   Choose Basic Plan
</button>
```

---

## 🧪 Testing After Price ID Update

### Test in Stripe Test Mode:
1. **Create test checkout sessions** with new price IDs
2. **Verify webhook events** are received correctly
3. **Check credit allocation** works with real price IDs
4. **Test all plan types** (subscriptions + credit packs)

### Expected Test Results:
- ✅ Pricing page loads without placeholder errors
- ✅ All plan buttons create valid checkout sessions
- ✅ Webhooks process payments and allocate credits
- ✅ No duplicate price ID errors in billing page

---

## 🚨 Common Issues & Solutions

### Issue: "Price not found"
**Cause**: Price ID doesn't exist or is from wrong Stripe account
**Solution**: Double-check price ID and Stripe account

### Issue: "Invalid price ID format"
**Cause**: Price ID doesn't follow `price_` format
**Solution**: Ensure you copied the Price ID, not Product ID

### Issue: "Subscription vs one-time mismatch"
**Cause**: Using subscription price for credit pack or vice versa
**Solution**: Verify price type matches plan type in Stripe

### Issue: "Webhook not receiving events"
**Cause**: Webhook endpoint not configured in Stripe
**Solution**: Add your webhook URL in Stripe Dashboard → Webhooks

---

## 📋 Pre-Production Checklist

Before switching to production:

### Stripe Configuration:
- [ ] All price IDs extracted and verified
- [ ] `price-config.json` updated with real IDs
- [ ] Backend webhook mapping updated
- [ ] Direct Stripe link removed from pricing page

### Testing Completed:
- [ ] All plan buttons work in test mode
- [ ] Checkout sessions create successfully
- [ ] Webhooks receive and process events
- [ ] Credits are allocated correctly
- [ ] Error handling works properly

### Production Readiness:
- [ ] Switch Stripe to live mode
- [ ] Update price IDs to live versions (if different)
- [ ] Configure production webhook endpoint
- [ ] Test with real payment methods
- [ ] Monitor for any errors

---

## 🔗 Quick Reference Links

- **Stripe Dashboard**: https://dashboard.stripe.com/products
- **Webhook Testing**: https://stripe.com/docs/webhooks/test
- **Price API Docs**: https://stripe.com/docs/api/prices
- **Checkout Session Docs**: https://stripe.com/docs/api/checkout/sessions

---

**Next Step**: Extract your real price IDs and update the configuration files, then proceed to Phase 5 testing!