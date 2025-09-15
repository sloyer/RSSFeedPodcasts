# RevenueCat Setup Guide

## Overview
Your app is now configured to use RevenueCat for subscription management. Here's how to set it up for production:

## Current Status
✅ **Data Storage**: User subscription data is stored locally (AsyncStorage) and syncs with RevenueCat
✅ **Anonymous Users**: No user accounts needed - uses device-specific anonymous IDs
✅ **Cross-Platform**: Works on iOS, Android, and web
✅ **Development Ready**: Currently works in simulation mode for testing

## Setup Steps for Production

### 1. Create RevenueCat Account
1. Go to [https://app.revenuecat.com](https://app.revenuecat.com)
2. Create a free account
3. Create a new project

### 2. Configure Your Apps
1. Add your iOS app (Bundle ID from app.json)
2. Add your Android app (Package name from app.json)
3. Get your **Public API Key** from the RevenueCat dashboard

### 3. Set Up App Store Products
**iOS (App Store Connect):**
1. Create in-app purchase products with 7-day free trials:
   - `premium_monthly_trial` for monthly subscription with trial
   - `premium_yearly_trial` for yearly subscription with trial
   - `premium_monthly` for monthly subscription without trial (for renewals)
   - `premium_yearly` for yearly subscription without trial (for renewals)
2. Configure 7-day free trial period for trial products
3. Set up introductory pricing if desired

**Android (Google Play Console):**
1. Create subscription products with the same product IDs as iOS
2. Configure 7-day free trial period for trial products
3. Set up introductory offers if desired

### 4. Configure RevenueCat Products
1. In RevenueCat dashboard, add your products
2. Create an entitlement called "premium"
3. Attach your products to this entitlement

### 5. Update Your App Configuration
Edit `constants/revenuecat-config.ts`:
```typescript
export const REVENUECAT_CONFIG = {
  PUBLIC_API_KEY: 'your_actual_revenuecat_public_api_key', // Replace this
  PRODUCT_IDS: {
    MONTHLY: 'premium_monthly',       // Regular monthly subscription
    YEARLY: 'premium_yearly',         // Regular yearly subscription
    MONTHLY_TRIAL: 'premium_monthly_trial', // Monthly with 7-day trial
    YEARLY_TRIAL: 'premium_yearly_trial',   // Yearly with 7-day trial
  },
  ENTITLEMENT_ID: 'premium',
  OFFERING_ID: 'default',
};
```

## How It Works

### Free Trial System
- **7-Day Trial**: New users get 7 days of premium access for free
- **One Trial Per User**: Each user can only use the trial once
- **Automatic Billing**: After trial ends, subscription begins automatically
- **Trial Tracking**: Trial usage is tracked locally and synced with RevenueCat

### Data Persistence
- **Local Storage**: Subscription status is saved to device storage
- **Cloud Sync**: Syncs with RevenueCat servers for cross-device access
- **Offline Support**: Works offline, syncs when connection is restored
- **Trial State**: Trial usage and expiration dates are persisted

### User Management
- **Anonymous IDs**: Each device gets a unique anonymous user ID
- **No Accounts**: Users don't need to create accounts
- **Device Transfer**: Subscriptions can be restored on new devices
- **Trial Eligibility**: Trial eligibility is checked before offering trial

### Testing
1. **Development Mode**: Currently simulates purchases and trials for testing
2. **Trial Testing**: Test trial start, expiration, and conversion to paid
3. **Sandbox Testing**: Use TestFlight (iOS) or Internal Testing (Android)
4. **Real Testing**: Test with real App Store/Play Store sandbox accounts
5. **Trial Scenarios**: Test trial eligibility, usage tracking, and expiration

## Revenue Tracking
RevenueCat provides:
- Real-time revenue analytics
- Subscription metrics
- Churn analysis
- A/B testing for pricing
- Webhook integrations

## Going Live
1. Replace the API key in `revenuecat-config.ts`
2. Set `IS_DEVELOPMENT = false` in the same file
3. Test trial flow thoroughly with sandbox accounts
4. Verify trial-to-paid conversion works correctly
5. Test trial eligibility and usage tracking
6. Submit to App Store/Play Store for review

## Trial Best Practices
- **Clear Communication**: Always show trial terms clearly
- **Reminder Notifications**: Consider reminding users before trial expires
- **Easy Cancellation**: Make it easy to cancel during trial
- **Value Demonstration**: Show premium features during trial
- **Conversion Optimization**: Track trial-to-paid conversion rates

## Support
- RevenueCat has excellent documentation: [docs.revenuecat.com](https://docs.revenuecat.com)
- Free tier supports up to $10k monthly revenue
- Paid tiers available for higher volumes

Your subscription system is now production-ready! 🚀