# Deploy Credit System to Railway

## ✅ What's Ready
- Backend API (credit tracking, Stripe checkout, webhook, admin API)
- Frontend UI (buy credits page, credits indicator, admin dashboard)
- Your account has unlimited free usage

## 🚀 Deployment Steps

### 1. Push to GitHub
```bash
cd ~/Desktop/Shot\ Logic
git push origin main
```

### 2. Configure Stripe Webhook (Critical!)
1. Go to https://dashboard.stripe.com/webhooks
2. Click "+ Add endpoint"
3. Enter webhook URL: `https://shotlogic.studio/api/webhook/stripe`
4. Select event: `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Go to Railway dashboard → ShotLogic project → Variables
8. Update `STRIPE_WEBHOOK_SECRET` with the new secret
9. Redeploy

### 3. Verify Environment Variables on Railway
Make sure these are set:
- ✅ `STRIPE_SECRET_KEY` (already set)
- ⚠️ `STRIPE_WEBHOOK_SECRET` (update this!)
- ✅ `ADMIN_USER_ID` (optional - defaults to your Clerk ID)

### 4. Railway Auto-Deploys
Railway will automatically deploy when you push to GitHub.

Wait for deployment to complete (~3-5 minutes).

## 🧪 Testing

### Test Your Admin Access (You)
1. Go to https://shotlogic.studio
2. Your credits indicator should show a high number (999999+)
3. Try analyzing a scene - no credits should be deducted
4. Check browser console - should see "Admin user bypassing credit check"

### Test Buy Credits Flow (Use Stripe Test Mode)
1. Switch Stripe to test mode in dashboard
2. Update `STRIPE_SECRET_KEY` to test key (starts with `sk_test_...`)
3. Go to `/buy-credits`
4. Click "Buy" on any pack
5. Use test card: `4242 4242 4242 4242`
6. Complete checkout
7. Should redirect back with credits added

### Test Admin Dashboard
1. Go to `/admin/credits`
2. Search for a test user's Clerk ID
3. Grant them 100 credits with reason "Beta tester"
4. Verify balance updates

## 📋 Post-Deploy Checklist

- [ ] Pushed code to GitHub
- [ ] Updated `STRIPE_WEBHOOK_SECRET` on Railway
- [ ] Railway deployment completed successfully
- [ ] Tested buy credits flow (Stripe test mode)
- [ ] Tested admin credit grants
- [ ] Tested scene analysis with credits
- [ ] Switched Stripe back to live mode

## 🔴 Go Live Checklist

- [ ] All testing complete
- [ ] Switch Stripe to **live mode**
- [ ] Update `STRIPE_SECRET_KEY` to live key
- [ ] Recreate webhook with live endpoint
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
- [ ] Test one small purchase yourself ($15 pack)
- [ ] Announce to users!

## 🛠️ Troubleshooting

**Credits not adding after purchase:**
- Check webhook is configured correctly
- Check Railway logs for webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` matches dashboard

**"Unauthorized" error in admin dashboard:**
- Verify your Clerk user ID is in `ADMIN_USER_IDS` array
- Check browser console for your actual user ID
- Can override with `ADMIN_USER_ID` env var on Railway

**Scene analysis still deducting credits (for you):**
- Check your Clerk user ID matches the hardcoded admin ID
- Look for "Admin user bypassing credit check" in server logs

## 📊 Monitoring

**Check credit purchases:**
- Stripe Dashboard → Payments
- MongoDB `users` collection → `purchaseHistory`

**Check usage stats:**
- MongoDB `users` collection → `usageHistory`
- Admin dashboard (search for specific users)

## 🆘 Support

If something breaks:
1. Check Railway logs
2. Check Stripe webhook logs
3. Check MongoDB `users` collection
4. Ping me (Bot Dylan) 🎸
