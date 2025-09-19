# OCR Packages - Stripe Payment Links & Configuration

**Product ID**: `prod_T1C9SX6tKDm8cR`
**Generated**: January 18, 2025

---

## 🔄 Subscription Plans (Monthly Recurring)

### Basic Plan - $14.99/month
- **Price ID**: `price_1S59leERMwo4L7iyIqBZXwkj`
- **Payment Link**: https://buy.stripe.com/test_14A8wP6JRcHI9Jk0F16wE02
- **Credits**: 100 monthly
- **Features**: Basic OCR processing, Standard support

### Vision Pro+ - $49.99/month
- **Price ID**: `price_1S59leERMwo4L7iyKqoKPlp2`
- **Payment Link**: https://buy.stripe.com/test_7sY9ATc4b234bRsafB6wE03
- **Credits**: 500 monthly
- **Features**: Advanced vision processing, Priority support, Batch processing

### Vision Max - $129.99/month
- **Price ID**: `price_1S59leERMwo4L7iyUPrEiYsQ`
- **Payment Link**: https://buy.stripe.com/test_3cIfZhecj6jkbRsdrN6wE04
- **Credits**: 2000 monthly
- **Features**: Enterprise-grade processing, 24/7 priority support, Custom integrations

---

## 💰 Credit Packs (One-time Purchase)

### Quick Scan - $9.99
- **Price ID**: `price_1S8SP6ERMwo4L7iyCRXJY6jl`
- **Payment Link**: https://buy.stripe.com/test_cNi28r6JR9vw4p0afB6wE05
- **Credits**: 50 credits
- **Description**: Perfect for occasional document scanning

### Power Pack - $39.99
- **Price ID**: `price_1S8SRSERMwo4L7iy9OeaVIr3`
- **Payment Link**: https://buy.stripe.com/test_14A9ATd8fgXY6x83Rd6wE06
- **Credits**: 250 credits
- **Description**: Great value for regular users
- **Badge**: Most Popular

### Professional - $89.99
- **Price ID**: `price_1S8SRpERMwo4L7iyu230zcuA`
- **Payment Link**: https://buy.stripe.com/test_6oU3cvc4bbDE1cOgDZ6wE07
- **Credits**: 600 credits
- **Description**: For heavy document processing needs

### Enterprise - $129.99
- **Price ID**: `price_1S8SSIERMwo4L7iykBOMIH4n`
- **Payment Link**: https://buy.stripe.com/test_4gMaEX0lt8rsg7I1J56wE08
- **Credits**: 1000 credits
- **Description**: Maximum credits for enterprise workflows

---

## 🔧 Implementation Updates Required

### 1. Update Webhook Configuration (api/stripe-webhook.js)
Replace the CREDIT_MAPPING object (lines 20-59) with:

```javascript
const CREDIT_MAPPING = {
    // Subscription Plans (monthly recurring)
    'price_1S59leERMwo4L7iyIqBZXwkj': {
        credits: 100,
        reason: 'basic_plan_monthly',
        plan_type: 'basic'
    },
    'price_1S59leERMwo4L7iyKqoKPlp2': {
        credits: 500,
        reason: 'vision_pro_monthly',
        plan_type: 'vision_pro'
    },
    'price_1S59leERMwo4L7iyUPrEiYsQ': {
        credits: 2000,
        reason: 'vision_max_monthly',
        plan_type: 'vision_max'
    },

    // Credit Packs (one-time purchases)
    'price_1S8SP6ERMwo4L7iyCRXJY6jl': {
        credits: 50,
        reason: 'quick_scan_purchase',
        plan_type: 'credits'
    },
    'price_1S8SRSERMwo4L7iy9OeaVIr3': {
        credits: 250,
        reason: 'power_pack_purchase',
        plan_type: 'credits'
    },
    'price_1S8SRpERMwo4L7iyu230zcuA': {
        credits: 600,
        reason: 'professional_purchase',
        plan_type: 'credits'
    },
    'price_1S8SSIERMwo4L7iykBOMIH4n': {
        credits: 1000,
        reason: 'enterprise_purchase',
        plan_type: 'credits'
    }
};
```

### 2. Update Price Configuration (price-config.json)
Replace placeholder price IDs with real ones:

```json
{
  "subscriptions": {
    "basic": {
      "priceId": "price_1S59leERMwo4L7iyIqBZXwkj",
      "paymentLink": "https://buy.stripe.com/test_14A8wP6JRcHI9Jk0F16wE02"
    },
    "vision_pro": {
      "priceId": "price_1S59leERMwo4L7iyKqoKPlp2",
      "paymentLink": "https://buy.stripe.com/test_7sY9ATc4b234bRsafB6wE03"
    },
    "vision_max": {
      "priceId": "price_1S59leERMwo4L7iyUPrEiYsQ",
      "paymentLink": "https://buy.stripe.com/test_3cIfZhecj6jkbRsdrN6wE04"
    }
  },
  "creditPacks": {
    "quick_scan": {
      "priceId": "price_1S8SP6ERMwo4L7iyCRXJY6jl",
      "paymentLink": "https://buy.stripe.com/test_cNi28r6JR9vw4p0afB6wE05"
    },
    "power_pack": {
      "priceId": "price_1S8SRSERMwo4L7iy9OeaVIr3",
      "paymentLink": "https://buy.stripe.com/test_14A9ATd8fgXY6x83Rd6wE06"
    },
    "professional": {
      "priceId": "price_1S8SRpERMwo4L7iyu230zcuA",
      "paymentLink": "https://buy.stripe.com/test_6oU3cvc4bbDE1cOgDZ6wE07"
    },
    "enterprise": {
      "priceId": "price_1S8SSIERMwo4L7iykBOMIH4n",
      "paymentLink": "https://buy.stripe.com/test_4gMaEX0lt8rsg7I1J56wE08"
    }
  }
}
```

---

## 🎯 Button Mapping for HTML Updates

### Pricing Page (pricing.html)
Update data-price-id attributes:

```html
<!-- Basic Plan -->
<button data-price-id="price_1S59leERMwo4L7iyIqBZXwkj" data-plan="basic">
    Choose Basic Plan
</button>

<!-- Vision Pro+ -->
<button data-price-id="price_1S59leERMwo4L7iyKqoKPlp2" data-plan="vision_pro">
    Choose Vision Pro+
</button>

<!-- Vision Max -->
<button data-price-id="price_1S59leERMwo4L7iyUPrEiYsQ" data-plan="vision_max">
    Choose Vision Max
</button>

<!-- Quick Scan -->
<button data-price-id="price_1S8SP6ERMwo4L7iyCRXJY6jl" data-plan="quick_scan">
    Buy Quick Scan
</button>

<!-- Power Pack -->
<button data-price-id="price_1S8SRSERMwo4L7iy9OeaVIr3" data-plan="power_pack">
    Buy Power Pack
</button>

<!-- Professional -->
<button data-price-id="price_1S8SRpERMwo4L7iyu230zcuA" data-plan="professional">
    Buy Professional
</button>

<!-- Enterprise -->
<button data-price-id="price_1S8SSIERMwo4L7iykBOMIH4n" data-plan="enterprise">
    Buy Enterprise
</button>
```

### Billing Sidebar (index.html)
Update billing buttons with same price IDs and data attributes.

---

## ✅ Testing Checklist

After implementing these updates:

1. **Test Each Payment Link**: Click through each payment link to verify they work
2. **Test Webhook**: Complete a test payment and verify credits are allocated
3. **Test Button Integration**: Ensure pricing page buttons use correct price IDs
4. **Test Billing Sidebar**: Verify billing buttons work from dashboard
5. **Monitor Logs**: Check webhook logs for successful payment processing

---

## 🚨 Important Notes

- **Test Mode**: All links are currently in test mode (test_ prefix)
- **Webhook Events**: Ensure webhook is configured for these events:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
- **Environment**: Update environment variables with webhook secret
- **Production**: When going live, regenerate payment links in live mode

---

*Generated: January 18, 2025*
*Status: Ready for implementation*