export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  feedLimits: {
    news: number;
    youtube: number;
    podcasts: number;
  };
  hasFreeTrial?: boolean;
  trialDays?: number;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt?: Date;
  planId?: string;
  isTrialActive?: boolean;
  trialEndsAt?: Date;
  hasUsedTrial?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    price: 0,
    interval: 'monthly',
    features: [
      '3 news feeds',
      '3 YouTube channels',
      '3 podcast sources',
      'Basic content access'
    ],
    feedLimits: {
      news: 3,
      youtube: 3,
      podcasts: 3
    }
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    tier: 'premium',
    price: 4.99,
    interval: 'monthly',
    features: [
      '7-day free trial',
      'Unlimited news feeds',
      'Unlimited YouTube channels',
      'Unlimited podcast sources',
      'Custom feed management',
      'Priority loading',
      'Ad-free experience'
    ],
    feedLimits: {
      news: -1, // -1 means unlimited
      youtube: -1,
      podcasts: -1
    },
    hasFreeTrial: true,
    trialDays: 7
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    tier: 'premium',
    price: 49.99,
    interval: 'yearly',
    features: [
      '7-day free trial',
      'Unlimited news feeds',
      'Unlimited YouTube channels',
      'Unlimited podcast sources',
      'Custom feed management',
      'Priority loading',
      'Ad-free experience',
      '2 months free'
    ],
    feedLimits: {
      news: -1,
      youtube: -1,
      podcasts: -1
    },
    hasFreeTrial: true,
    trialDays: 7
  }
];