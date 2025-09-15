// RevenueCat Configuration
// Replace these with your actual RevenueCat credentials when ready for production

export const REVENUECAT_CONFIG = {
  // Get these from your RevenueCat dashboard
  PUBLIC_API_KEY: 'your_revenuecat_public_api_key',
  
  // Product IDs - these should match your App Store Connect / Google Play Console products
  PRODUCT_IDS: {
    MONTHLY: 'premium_monthly',
    YEARLY: 'premium_yearly',
    // Trial products (these will have 7-day free trial configured in App Store/Play Store)
    MONTHLY_TRIAL: 'premium_monthly_trial',
    YEARLY_TRIAL: 'premium_yearly_trial',
  },
  
  // Entitlement identifier - this is what you'll check for premium access
  ENTITLEMENT_ID: 'premium',
  
  // Offering identifier - used for A/B testing different subscription offers
  OFFERING_ID: 'default',
};

// Development mode - set to false for production
export const IS_DEVELOPMENT = __DEV__;

// Base URL for RevenueCat API
export const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v1';

// Instructions for setting up RevenueCat:
/*
1. Create a RevenueCat account at https://app.revenuecat.com
2. Create a new project
3. Add your iOS and Android apps
4. Configure your products in App Store Connect and Google Play Console
5. Add the products to RevenueCat
6. Get your public API key from RevenueCat dashboard
7. Replace REVENUECAT_CONFIG.PUBLIC_API_KEY with your actual key
8. Update PRODUCT_IDS to match your actual product identifiers
9. Configure 7-day free trials for trial products in App Store Connect/Google Play Console
10. Use trial product IDs for first-time subscribers, regular IDs for renewals

For testing:
- RevenueCat provides sandbox testing
- You can test purchases without real money
- Use TestFlight (iOS) or Internal Testing (Android) for testing

For production:
- Set IS_DEVELOPMENT to false
- Ensure all product IDs match your store listings
- Test thoroughly before release
*/