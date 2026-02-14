# ShotLogic Stripe Credit System

## ✅ What's Already Built

### Backend (API)
- ✅ **Credit tracking** (`api/lib/credits.ts`)
  - User credit balances in MongoDB
  - Purchase history
  - Usage history
  - Admin/tester support
- ✅ **Stripe checkout** (`api/credits/create-checkout.ts`)
  - 4 credit packs configured:
    - Starter: 50 scenes = $15
    - Standard: 150 scenes = $35
    - Pro: 500 scenes = $100
    - Bulk: 1500 scenes = $250
- ✅ **Stripe webhook** (`api/webhook/stripe.ts`)
  - Handles `checkout.session.completed`
  - Auto-adds credits after payment
- ✅ **Scene analysis integration** (`api/analyze-scene.ts`)
  - Checks credits before analysis (1 credit/scene)
  - Deducts credits after successful analysis
- ✅ **Admin API** (`api/admin/manage-credits.ts`) ← **NEW!**
  - GET `/api/admin/manage-credits?userId=xxx` - View user balance
  - POST `/api/admin/manage-credits` - Grant free credits to users
  - DELETE `/api/admin/manage-credits` - Remove credits (corrections)

### Admin & Tester Support
- ✅ **Your account** gets unlimited free usage
  - Your Clerk user ID is hardcoded as admin
  - Credit checks bypassed
  - Usage still logged (for stats)
- ✅ **Test users** can be granted credits via admin API
  - No payment required
  - Tracked separately in `adminGrants` field

---

## 🚧 What Still Needs to Be Done

### 1. Frontend UI (Priority)
- [ ] **Buy Credits page** (`/buy-credits`)
  - Show 4 credit pack options
  - "Buy Now" button → Stripe Checkout
  - Current balance display
- [ ] **Credits indicator** (navbar/header)
  - Show remaining credits
  - Link to buy more
  - Warning when low (<10 credits)
- [ ] **Admin dashboard** (`/admin/credits`)
  - List all users + balances
  - Grant credits form
  - View usage stats

### 2. Stripe Configuration
- [x] **Stripe Secret Key** set in `.env.local` ✅
- [ ] **Stripe Webhook Secret** needs updating:
  1. Go to https://dashboard.stripe.com/webhooks
  2. Create endpoint: `https://shotlogic.studio/api/webhook/stripe`
  3. Select event: `checkout.session.completed`
  4. Copy signing secret
  5. Update `.env.local`:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
     ```
  6. Redeploy to Railway

### 3. Testing
- [ ] Test full purchase flow (use Stripe test mode first)
- [ ] Test admin credit grants
- [ ] Test low credit warnings
- [ ] Test scene analysis with/without credits

---

## 🎯 Quick Start (What You Can Do Now)

### Grant Yourself Admin Status (Already Done)
Your Clerk user ID is already hardcoded as admin in:
- `api/lib/credits.ts`
- `api/admin/manage-credits.ts`

You automatically bypass all credit checks. ✅

### Grant Credits to a Test User
```bash
curl -X POST https://shotlogic.studio/api/admin/manage-credits \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_CLERK_USER_ID" \
  -d '{
    "userId": "user_TEST_USER_ID",
    "credits": 100,
    "reason": "Beta tester"
  }'
```

### Check a User's Balance
```bash
curl -X GET "https://shotlogic.studio/api/admin/manage-credits?userId=user_TEST_USER_ID" \
  -H "x-user-id: YOUR_CLERK_USER_ID"
```

---

## 💰 Pricing Strategy

**Current pricing** (configured in `api/credits/create-checkout.ts`):
- **$0.30/scene** (Starter pack)
- **$0.23/scene** (Standard - best value)
- **$0.20/scene** (Pro)
- **$0.17/scene** (Bulk - volume discount)

**Your costs:**
- ~$0.15-0.20/scene (Claude API)
- Profit margin: **$0.03-0.15/scene**

This covers API costs + provides healthy profit margin.

---

## 🔐 Security Notes

1. **Admin API** requires:
   - Your Clerk user ID in `x-user-id` header, OR
   - Admin API key in `x-api-key` header
2. **Webhook** verifies Stripe signature (after you set webhook secret)
3. **Credit deductions** use MongoDB atomic operations (no race conditions)
4. **Admin user IDs** are env-configurable for security

---

## 📊 Usage Tracking

All credit usage is logged in MongoDB `users` collection:
- `purchaseHistory[]` - All purchases (Stripe payments + admin grants)
- `usageHistory[]` - Every scene analysis
- `adminGrants[]` - Free credits given by admin
- `adminAdjustments[]` - Credit corrections

You can query this for analytics/billing reports.

---

## 🚀 Next Steps

1. **Set webhook secret** (5 minutes) ← Critical
2. **Build frontend UI** (I can do this - 1-2 hours)
3. **Test with Stripe test mode**
4. **Go live!**

Want me to build the frontend pages now?
