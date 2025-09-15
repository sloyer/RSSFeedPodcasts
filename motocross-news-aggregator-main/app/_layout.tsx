import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, StyleSheet } from "react-native";

import { NewsProvider } from "@/hooks/use-news-store";
import { YouTubeProvider } from "@/hooks/use-youtube-store";
import { PodcastProvider } from "@/hooks/use-podcast-store";
import { PodcastPlayerProvider, usePodcastPlayer } from "@/hooks/use-podcast-player";
import { SubscriptionProvider } from "@/hooks/use-subscription";
import { BannerProvider } from "@/hooks/use-banner";
import MiniPlayer from "@/components/MiniPlayer";
import FullPlayer from "@/components/FullPlayer";
import Colors from "@/constants/colors";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ 
      headerBackTitle: "Back",
      headerStyle: {
        backgroundColor: Colors.light.primary,
      },
      headerTintColor: "#fff",
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="article/[id]" 
        options={{ 
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }} 
      />
      <Stack.Screen 
        name="video/[id]" 
        options={{ 
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }} 
      />
      <Stack.Screen 
        name="subscription" 
        options={{ 
          headerShown: true,
          presentation: "modal",
          animation: "slide_from_bottom",
        }} 
      />

    </Stack>
  );
}

function AppContent() {
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const { playbackState } = usePodcastPlayer();
  const hasCurrentEpisode = Boolean(playbackState.currentEpisode);

  return (
    <View style={styles.container}>
      <RootLayoutNav />
      
      <MiniPlayer 
        onExpand={() => setShowFullPlayer(true)} 
        visible={hasCurrentEpisode}
      />
      
      <FullPlayer 
        visible={showFullPlayer && hasCurrentEpisode} 
        onClose={() => setShowFullPlayer(false)} 
      />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <BannerProvider>
          <NewsProvider>
            <YouTubeProvider>
              <PodcastProvider>
                <PodcastPlayerProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <AppContent />
                  </GestureHandlerRootView>
                </PodcastPlayerProvider>
              </PodcastProvider>
            </YouTubeProvider>
          </NewsProvider>
        </BannerProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});