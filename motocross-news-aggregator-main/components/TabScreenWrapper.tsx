import React from 'react';
import { View, StyleSheet } from 'react-native';
import PremiumBanner from '@/components/PremiumBanner';
import { useBanner } from '@/hooks/use-banner';
import { useSubscription } from '@/hooks/use-subscription';

interface TabScreenWrapperProps {
  children: React.ReactNode;
}

export default function TabScreenWrapper({ children }: TabScreenWrapperProps) {
  const { isBannerVisible, closeBanner } = useBanner();
  const { isPremium, isLoading } = useSubscription();

  // Don't show banner if user is premium or subscription is still loading
  const shouldShowBanner = !isLoading && !isPremium && isBannerVisible;

  return (
    <View style={styles.container}>
      {shouldShowBanner && <PremiumBanner onClose={closeBanner} />}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});