import { useState, useCallback, useMemo, useEffect } from 'react';
import { AppState } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';

export const [BannerProvider, useBanner] = createContextHook(() => {
  const [isBannerVisible, setIsBannerVisible] = useState<boolean>(true);

  // Reset banner visibility when app becomes active (app opens)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active, resetting banner visibility');
        setIsBannerVisible(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const closeBanner = useCallback(() => {
    console.log('🚫 Closing premium banner');
    setIsBannerVisible(false);
  }, []);

  const resetBanner = useCallback(() => {
    console.log('🔄 Resetting premium banner visibility');
    setIsBannerVisible(true);
  }, []);

  return useMemo(() => ({
    isBannerVisible,
    closeBanner,
    resetBanner,
  }), [isBannerVisible, closeBanner, resetBanner]);
});