import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { SubscriptionStatus, SUBSCRIPTION_PLANS } from '@/types/subscription';
import * as Crypto from 'expo-crypto';
import { REVENUECAT_CONFIG, REVENUECAT_BASE_URL } from '@/constants/revenuecat-config';

const SUBSCRIPTION_STORAGE_KEY = 'subscription_status';
const USER_ID_STORAGE_KEY = 'revenuecat_user_id';
const TRIAL_USAGE_KEY = 'has_used_trial';

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    tier: 'free',
    isActive: true,
    hasUsedTrial: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Generate or load user ID
  const getUserId = useCallback(async (): Promise<string> => {
    try {
      let storedUserId = await AsyncStorage.getItem(USER_ID_STORAGE_KEY);
      if (!storedUserId) {
        // Generate anonymous user ID
        storedUserId = await Crypto.randomUUID();
        await AsyncStorage.setItem(USER_ID_STORAGE_KEY, storedUserId);
      }
      return storedUserId;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return 'anonymous_' + Date.now();
    }
  }, []);

  // Get trial usage status
  const getTrialUsageStatus = useCallback(async (): Promise<boolean> => {
    try {
      const hasUsed = await AsyncStorage.getItem(TRIAL_USAGE_KEY);
      return hasUsed === 'true';
    } catch (error) {
      console.error('Error getting trial usage status:', error);
      return false;
    }
  }, []);

  // Mark trial as used
  const markTrialAsUsed = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TRIAL_USAGE_KEY, 'true');
    } catch (error) {
      console.error('Error marking trial as used:', error);
    }
  }, []);

  // Save subscription status to storage
  const saveSubscriptionStatus = useCallback(async (status: SubscriptionStatus) => {
    try {
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(status));
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Error saving subscription status:', error);
    }
  }, []);

  // Sync with RevenueCat
  const syncWithRevenueCat = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${REVENUECAT_BASE_URL}/subscribers/${userId}`, {
        headers: {
          'Authorization': `Bearer ${REVENUECAT_CONFIG.PUBLIC_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const subscriber = data.subscriber;
        
        // Check if user has active subscription or trial
        const hasActiveSubscription = Object.values(subscriber.entitlements || {}).some(
          (entitlement: any) => entitlement.expires_date === null || new Date(entitlement.expires_date) > new Date()
        );

        if (hasActiveSubscription) {
          const activeEntitlement = Object.values(subscriber.entitlements || {})[0] as any;
          const expiresAt = activeEntitlement.expires_date ? new Date(activeEntitlement.expires_date) : undefined;
          
          // Check if this is a trial period
          const isTrialActive = activeEntitlement.will_renew === false && expiresAt && expiresAt > new Date();
          
          const newStatus: SubscriptionStatus = {
            tier: 'premium',
            isActive: true,
            expiresAt,
            planId: activeEntitlement.product_identifier,
            isTrialActive,
            trialEndsAt: isTrialActive ? expiresAt : undefined,
            hasUsedTrial: await getTrialUsageStatus(),
          };
          await saveSubscriptionStatus(newStatus);
        } else {
          // No active subscription
          const freeStatus: SubscriptionStatus = {
            tier: 'free',
            isActive: true,
            hasUsedTrial: await getTrialUsageStatus(),
          };
          await saveSubscriptionStatus(freeStatus);
        }
      }
    } catch (error) {
      console.error('Error syncing with RevenueCat:', error);
      // Continue with local data if sync fails
    }
  }, [getTrialUsageStatus, saveSubscriptionStatus]);

  // Load subscription status from storage and sync with RevenueCat
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      try {
        // Get user ID
        const currentUserId = await getUserId();
        setUserId(currentUserId);

        // Load local subscription status
        const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert date strings back to Date objects
          if (parsed.expiresAt) {
            parsed.expiresAt = new Date(parsed.expiresAt);
          }
          if (parsed.trialEndsAt) {
            parsed.trialEndsAt = new Date(parsed.trialEndsAt);
          }
          // Ensure hasUsedTrial is set
          if (parsed.hasUsedTrial === undefined) {
            parsed.hasUsedTrial = await getTrialUsageStatus();
          }
          setSubscriptionStatus(parsed);
        }

        // Sync with RevenueCat in background
        syncWithRevenueCat(currentUserId).catch(console.error);
      } catch (error) {
        console.error('Error loading subscription status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionStatus();
  }, [getUserId, getTrialUsageStatus, syncWithRevenueCat]);

  // Check if subscription is expired
  const isSubscriptionExpired = useCallback(() => {
    if (subscriptionStatus.tier === 'free') return false;
    if (!subscriptionStatus.expiresAt) return false;
    return new Date() > subscriptionStatus.expiresAt;
  }, [subscriptionStatus.tier, subscriptionStatus.expiresAt]);

  // Check if trial is expired
  const isTrialExpired = useCallback(() => {
    if (!subscriptionStatus.isTrialActive || !subscriptionStatus.trialEndsAt) return false;
    return new Date() > subscriptionStatus.trialEndsAt;
  }, [subscriptionStatus.isTrialActive, subscriptionStatus.trialEndsAt]);

  // Check if user can start a trial
  const canStartTrial = useCallback(() => {
    return !subscriptionStatus.hasUsedTrial && subscriptionStatus.tier === 'free';
  }, [subscriptionStatus.hasUsedTrial, subscriptionStatus.tier]);

  // Get days remaining in trial
  const getTrialDaysRemaining = useCallback((): number => {
    if (!subscriptionStatus.isTrialActive || !subscriptionStatus.trialEndsAt) return 0;
    const now = new Date();
    const trialEnd = subscriptionStatus.trialEndsAt;
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [subscriptionStatus.isTrialActive, subscriptionStatus.trialEndsAt]);

  // Get current subscription plan
  const getCurrentPlan = useCallback(() => {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === subscriptionStatus.planId) || SUBSCRIPTION_PLANS[0];
  }, [subscriptionStatus.planId]);

  // Get feed limits based on current subscription
  const getFeedLimits = useCallback(() => {
    const currentPlan = getCurrentPlan();
    return currentPlan.feedLimits;
  }, [getCurrentPlan]);

  // Check if user can enable more feeds of a specific type
  const canEnableMoreFeeds = useCallback((type: 'news' | 'youtube' | 'podcasts', currentEnabledCount: number) => {
    const limits = getFeedLimits();
    const limit = limits[type];
    return limit === -1 || currentEnabledCount < limit;
  }, [getFeedLimits]);

  // Start free trial
  const startFreeTrial = useCallback(async (planId: string) => {
    if (!userId) throw new Error('User ID not available');
    if (!canStartTrial()) throw new Error('Trial not available');
    
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan || !plan.hasFreeTrial) throw new Error('Plan does not offer free trial');

    try {
      // Mark trial as used
      await markTrialAsUsed();
      
      // Calculate trial end date
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + (plan.trialDays || 7));
      
      // In development, simulate trial start
      const newStatus: SubscriptionStatus = {
        tier: 'premium',
        isActive: true,
        expiresAt: trialEndsAt,
        planId: plan.id,
        isTrialActive: true,
        trialEndsAt,
        hasUsedTrial: true,
      };

      await saveSubscriptionStatus(newStatus);
      console.log(`🎉 Started ${plan.trialDays}-day free trial for ${plan.name}`);
    } catch (error) {
      console.error('Error starting free trial:', error);
      throw error;
    }
  }, [userId, canStartTrial, markTrialAsUsed, saveSubscriptionStatus]);

  // Purchase subscription through RevenueCat
  const purchaseSubscription = useCallback(async (planId: string, startTrial: boolean = false) => {
    if (!userId) throw new Error('User ID not available');
    
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');

    // If starting trial and user is eligible
    if (startTrial && canStartTrial() && plan.hasFreeTrial) {
      return await startFreeTrial(planId);
    }

    try {
      // Determine which product ID to use (trial or regular)
      let productId = planId;
      if (startTrial && plan.hasFreeTrial && canStartTrial()) {
        productId = plan.interval === 'monthly' 
          ? REVENUECAT_CONFIG.PRODUCT_IDS.MONTHLY_TRIAL
          : REVENUECAT_CONFIG.PRODUCT_IDS.YEARLY_TRIAL;
      }
      
      // Create purchase receipt data
      const receiptData = {
        app_user_id: userId,
        fetch_token: await Crypto.randomUUID(),
        product_id: productId,
        price: startTrial && plan.hasFreeTrial ? 0 : plan.price, // Free for trial
        currency: 'USD',
        is_restore: false,
        presented_offering_identifier: 'default',
      };

      // Send receipt to RevenueCat (in production, this would be done automatically)
      const response = await fetch(`${REVENUECAT_BASE_URL}/receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REVENUECAT_CONFIG.PUBLIC_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData),
      });

      if (response.ok) {
        // Sync with RevenueCat to get updated subscription status
        await syncWithRevenueCat(userId);
      } else {
        // Fallback to local simulation for development
        const now = new Date();
        let expiresAt: Date;
        let isTrialActive = false;
        let trialEndsAt: Date | undefined;
        
        if (startTrial && plan.hasFreeTrial && canStartTrial()) {
          // Trial period
          expiresAt = new Date(now);
          expiresAt.setDate(expiresAt.getDate() + (plan.trialDays || 7));
          isTrialActive = true;
          trialEndsAt = expiresAt;
          await markTrialAsUsed();
        } else {
          // Regular subscription
          expiresAt = new Date(now);
          if (plan.interval === 'monthly') {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          } else {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          }
        }

        const newStatus: SubscriptionStatus = {
          tier: plan.tier,
          isActive: true,
          expiresAt,
          planId: plan.id,
          isTrialActive,
          trialEndsAt,
          hasUsedTrial: await getTrialUsageStatus(),
        };

        await saveSubscriptionStatus(newStatus);
      }
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      throw error;
    }
  }, [userId, canStartTrial, startFreeTrial, markTrialAsUsed, getTrialUsageStatus, saveSubscriptionStatus, syncWithRevenueCat]);

  // Cancel subscription (set to expire at end of current period)
  const cancelSubscription = useCallback(async () => {
    if (subscriptionStatus.tier === 'free') return;

    const newStatus: SubscriptionStatus = {
      ...subscriptionStatus,
      isActive: false,
    };

    await saveSubscriptionStatus(newStatus);
  }, [subscriptionStatus, saveSubscriptionStatus]);

  // Restore subscription from RevenueCat
  const restoreSubscription = useCallback(async () => {
    if (!userId) throw new Error('User ID not available');
    
    try {
      // Sync with RevenueCat to restore purchases
      await syncWithRevenueCat(userId);
    } catch (error) {
      console.error('Error restoring subscription:', error);
      throw error;
    }
  }, [userId, syncWithRevenueCat]);

  const isPremium = subscriptionStatus.tier === 'premium' && subscriptionStatus.isActive && !isSubscriptionExpired() && !isTrialExpired();
  
  const isInTrial = subscriptionStatus.isTrialActive && !isTrialExpired();

  const syncWithRevenueCatMemo = useCallback(() => {
    if (!userId) return Promise.resolve();
    return syncWithRevenueCat(userId);
  }, [userId, syncWithRevenueCat]);

  return useMemo(() => ({
    subscriptionStatus,
    isLoading,
    isPremium,
    isInTrial,
    userId,
    getCurrentPlan,
    getFeedLimits,
    canEnableMoreFeeds,
    purchaseSubscription,
    startFreeTrial,
    cancelSubscription,
    restoreSubscription,
    isSubscriptionExpired,
    isTrialExpired,
    canStartTrial,
    getTrialDaysRemaining,
    syncWithRevenueCat: syncWithRevenueCatMemo,
  }), [
    subscriptionStatus,
    isLoading,
    isPremium,
    isInTrial,
    userId,
    getCurrentPlan,
    getFeedLimits,
    canEnableMoreFeeds,
    purchaseSubscription,
    startFreeTrial,
    cancelSubscription,
    restoreSubscription,
    isSubscriptionExpired,
    isTrialExpired,
    canStartTrial,
    getTrialDaysRemaining,
    syncWithRevenueCatMemo,
  ]);
});