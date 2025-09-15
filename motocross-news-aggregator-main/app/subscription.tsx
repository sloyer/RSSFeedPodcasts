import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Check, Crown, Star } from 'lucide-react-native';

import { useSubscription } from '@/hooks/use-subscription';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/types/subscription';
import Colors from '@/constants/colors';

export default function SubscriptionScreen() {
  const {
    subscriptionStatus,
    isPremium,
    isInTrial,
    getCurrentPlan,
    purchaseSubscription,
    startFreeTrial,
    cancelSubscription,
    restoreSubscription,
    canStartTrial,
    getTrialDaysRemaining,
  } = useSubscription();
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const currentPlan = getCurrentPlan();

  const handleStartTrial = async (planId: string) => {
    if (isLoading || processingPlan) return;
    
    setProcessingPlan(planId);
    try {
      await startFreeTrial(planId);
      Alert.alert(
        'Free Trial Started! 🎉',
        'You now have 7 days of premium access. Enjoy unlimited feeds!',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(
        'Trial Failed',
        'There was an error starting your free trial. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPlan(null);
    }
  };

  const handlePurchase = async (planId: string) => {
    if (isLoading || processingPlan) return;
    
    setProcessingPlan(planId);
    try {
      await purchaseSubscription(planId, false); // false = not starting trial
      Alert.alert(
        'Success!',
        'Your subscription has been activated. Enjoy unlimited access to all feeds!',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(
        'Purchase Failed',
        'There was an error processing your subscription. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await cancelSubscription();
              Alert.alert(
                'Subscription Cancelled',
                'Your subscription has been cancelled. You will retain access to premium features until the end of your current billing period.',
                [{ text: 'OK' }]
              );
            } catch {
              Alert.alert(
                'Error',
                'Failed to cancel subscription. Please try again or contact support.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      await restoreSubscription();
      Alert.alert(
        'Subscription Restored',
        'Your subscription has been restored successfully.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(
        'Error',
        'Failed to restore subscription. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isCurrentPlan = currentPlan.id === plan.id;
    const isSelected = selectedPlan === plan.id;
    const isPremiumPlan = plan.tier === 'premium';
    const isProcessing = processingPlan === plan.id;
    
    // If user has an active paid subscription, they can only interact with their current plan
    const hasActivePaidSubscription = isPremium && subscriptionStatus.isActive && !isInTrial;
    const canSelectPlan = !hasActivePaidSubscription || isCurrentPlan;
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isCurrentPlan && styles.currentPlanCard,
          isSelected && !isCurrentPlan && styles.selectedPlanCard,
          isPremiumPlan && styles.premiumPlanCard,
          !canSelectPlan && styles.disabledPlanCard,
        ]}
        onPress={() => {
          if (canSelectPlan && !isCurrentPlan && !isLoading && !processingPlan) {
            setSelectedPlan(isSelected ? null : plan.id);
          }
        }}
        disabled={!canSelectPlan || isCurrentPlan || isLoading || !!processingPlan}
      >
        <View style={styles.planHeader}>
          <View style={styles.planTitleContainer}>
            {isPremiumPlan && <Crown size={20} color={Colors.light.primary} />}
            <Text style={[styles.planTitle, isPremiumPlan && styles.premiumPlanTitle]}>
              {plan.name}
            </Text>
            {isCurrentPlan && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceContainer}>
            {plan.price > 0 ? (
              <>
                <Text style={[styles.price, isPremiumPlan && styles.premiumPrice]}>
                  ${plan.price}
                </Text>
                <Text style={styles.priceInterval}>/{plan.interval}</Text>
                {plan.interval === 'yearly' && (
                  <Text style={styles.savings}>Save 17%</Text>
                )}
              </>
            ) : (
              <Text style={styles.freePrice}>Free</Text>
            )}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={16} color={Colors.light.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {!isCurrentPlan && plan.tier === 'premium' && isSelected && canSelectPlan && (
          <View style={styles.buttonContainer}>
            {canStartTrial() && plan.hasFreeTrial && (
              <TouchableOpacity
                style={[
                  styles.trialButton,
                  (isLoading || processingPlan) && styles.disabledButton,
                ]}
                onPress={() => {
                  Alert.alert(
                    'Start Free Trial',
                    `You'll get 7 days of premium access for free. After the trial ends, you'll be automatically charged ${plan.price}/${plan.interval} unless you cancel. You can cancel anytime in your subscription settings.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Start Trial', 
                        onPress: () => handleStartTrial(plan.id)
                      }
                    ]
                  );
                }}
                disabled={isLoading || !!processingPlan}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                ) : (
                  <>
                    <Star size={16} color={Colors.light.primary} />
                    <Text style={styles.trialButtonText}>
                      Start 7-Day Free Trial
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.selectButton,
                canStartTrial() && plan.hasFreeTrial && styles.secondaryButton,
                (isLoading || processingPlan) && styles.disabledButton,
              ]}
              onPress={() => handlePurchase(plan.id)}
              disabled={isLoading || !!processingPlan}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Star size={16} color="#fff" />
                  <Text style={styles.selectButtonText}>
                    {canStartTrial() && plan.hasFreeTrial ? 'Subscribe Now' : 'Select Plan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {!canSelectPlan && !isCurrentPlan && (
          <View style={styles.lockedPlanContainer}>
            <Text style={styles.lockedPlanText}>
              Cancel your current subscription to change plans
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTintColor: '#fff',
        }}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Crown size={32} color={Colors.light.primary} />
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>
            Unlock unlimited access to all news feeds, YouTube channels, and podcasts
          </Text>
        </View>

        {isPremium && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Crown size={20} color={Colors.light.primary} />
              <Text style={styles.statusTitle}>
                {isInTrial ? 'Free Trial Active' : 'Premium Active'}
              </Text>
            </View>
            <Text style={styles.statusText}>
              {isInTrial 
                ? `You have ${getTrialDaysRemaining()} days left in your free trial.`
                : 'You have unlimited access to all feeds and premium features.'
              }
            </Text>
            {subscriptionStatus.expiresAt && (
              <Text style={styles.expiryText}>
                {isInTrial
                  ? `Trial ends on ${subscriptionStatus.expiresAt.toLocaleDateString()}`
                  : subscriptionStatus.isActive 
                    ? `Renews on ${subscriptionStatus.expiresAt.toLocaleDateString()}`
                    : `Expires on ${subscriptionStatus.expiresAt.toLocaleDateString()}`
                }
              </Text>
            )}
            {isInTrial && getTrialDaysRemaining() <= 3 && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  ⚠️ Your trial will automatically convert to a paid subscription unless you cancel before it expires. You will be charged ${getCurrentPlan().price}/${getCurrentPlan().interval} starting {subscriptionStatus.expiresAt?.toLocaleDateString()}.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.plansContainer}>
          {SUBSCRIPTION_PLANS.map(renderPlanCard)}
        </View>

        {isPremium && (
          <View style={styles.managementSection}>
            <Text style={styles.managementTitle}>Manage Subscription</Text>
            
            <TouchableOpacity
              style={[
                styles.managementButton,
                isLoading && styles.disabledButton,
              ]}
              onPress={handleRestore}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.light.text} />
              ) : (
                <Text style={styles.managementButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>
            
            {subscriptionStatus.isActive && (
              <TouchableOpacity
                style={[
                  styles.managementButton,
                  styles.cancelButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FF6B6B" />
                ) : (
                  <Text style={[styles.managementButtonText, styles.cancelButtonText]}>
                    Cancel Subscription
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            • 7-day free trial for new users{'\n'}
            • Cancel anytime before trial ends to avoid charges{'\n'}
            • Auto-renewal can be turned off in device settings{'\n'}
            • You&apos;ll be notified before any charges{'\n'}
            • No hidden fees{'\n'}
            • Instant activation
          </Text>
          <Text style={styles.legalText}>
            By starting a free trial, you agree that your subscription will automatically renew and you will be charged the subscription fee unless you cancel at least 24 hours before the end of your trial period.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 8,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 4,
  },
  expiryText: {
    fontSize: 12,
    color: Colors.light.placeholder,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currentPlanCard: {
    borderColor: Colors.light.primary,
    backgroundColor: '#F8F9FF',
  },
  selectedPlanCard: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
  premiumPlanCard: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
    position: 'relative',
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginLeft: 8,
  },
  premiumPlanTitle: {
    color: Colors.light.primary,
  },
  currentBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  premiumPrice: {
    color: Colors.light.primary,
  },
  priceInterval: {
    fontSize: 16,
    color: Colors.light.placeholder,
    marginLeft: 2,
  },
  freePrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  savings: {
    backgroundColor: '#FF6B35',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  featuresContainer: {
    gap: 8,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    gap: 8,
  },
  trialButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  trialButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: Colors.light.placeholder,
  },
  selectedButton: {
    backgroundColor: Colors.light.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledPlanCard: {
    opacity: 0.6,
  },
  lockedPlanContainer: {
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  lockedPlanText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  managementSection: {
    marginBottom: 24,
  },
  managementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  managementButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  cancelButton: {
    borderColor: '#FF6B6B',
  },
  managementButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: 'center',
  },
  cancelButtonText: {
    color: '#FF6B6B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalText: {
    fontSize: 12,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 12,
    fontStyle: 'italic',
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 18,
  },
});