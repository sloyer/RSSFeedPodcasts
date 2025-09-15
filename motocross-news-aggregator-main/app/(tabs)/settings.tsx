import React, { useState } from "react";
import { FlatList, StyleSheet, Switch, Text, View, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { Crown, Lock } from "lucide-react-native";

import TabScreenWrapper from "@/components/TabScreenWrapper";
import { useNewsStore } from "@/hooks/use-news-store";
import { useYouTubeStore } from "@/hooks/use-youtube-store";
import { usePodcastStore } from "@/hooks/use-podcast-store";
import { useSubscription } from "@/hooks/use-subscription";
import Colors from "@/constants/colors";

type SettingsTab = 'news' | 'youtube' | 'podcasts';

export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('news');
  const { enabledFeeds, toggleFeedEnabled } = useNewsStore();
  const { enabledChannels, toggleChannelEnabled } = useYouTubeStore();
  const { enabledPodcasts, togglePodcastEnabled } = usePodcastStore();
  const { isPremium, getFeedLimits, getCurrentPlan, canEnableMoreFeeds } = useSubscription();

  const feedLimits = getFeedLimits();
  const currentPlan = getCurrentPlan();

  const handleToggleFeed = (feedId: string, type: 'news' | 'youtube' | 'podcasts') => {
    const currentEnabledCount = {
      news: enabledFeeds.filter(f => f.enabled).length,
      youtube: enabledChannels.filter(c => c.enabled).length,
      podcasts: enabledPodcasts.filter(p => p.enabled).length,
    }[type];

    const currentFeed = {
      news: enabledFeeds.find(f => f.id === feedId),
      youtube: enabledChannels.find(c => c.id === feedId),
      podcasts: enabledPodcasts.find(p => p.id === feedId),
    }[type];

    if (!currentFeed) {
      console.error(`Feed ${feedId} not found in ${type}`);
      return;
    }

    const isEnabling = !currentFeed.enabled;
    
    // Only check limits if we're trying to enable a feed
    if (isEnabling && !canEnableMoreFeeds(type, currentEnabledCount)) {
      Alert.alert(
        'Subscription Limit Reached',
        `You can only enable ${feedLimits[type]} ${type} ${feedLimits[type] === 1 ? 'source' : 'sources'} with your current plan. Upgrade to Premium for unlimited access.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Upgrade', 
            onPress: () => router.push('/subscription')
          }
        ]
      );
      return;
    }

    // If we get here, the toggle is allowed
    switch (type) {
      case 'news':
        toggleFeedEnabled(feedId);
        break;
      case 'youtube':
        toggleChannelEnabled(feedId);
        break;
      case 'podcasts':
        togglePodcastEnabled(feedId);
        break;
    }
  };

  const renderSubscriptionBanner = () => {
    const currentType = activeTab;
    const limit = feedLimits[currentType];
    const currentEnabled = {
      news: enabledFeeds.filter(f => f.enabled).length,
      youtube: enabledChannels.filter(c => c.enabled).length,
      podcasts: enabledPodcasts.filter(p => p.enabled).length,
    }[currentType];

    return (
      <TouchableOpacity 
        style={[styles.subscriptionBanner, isPremium && styles.premiumBanner]}
        onPress={() => router.push('/subscription')}
      >
        <View style={styles.bannerContent}>
          {isPremium ? (
            <Crown size={20} color={Colors.light.primary} />
          ) : (
            <Lock size={20} color={Colors.light.placeholder} />
          )}
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, isPremium && styles.premiumBannerTitle]}>
              {isPremium ? 'Premium Active' : currentPlan.name}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isPremium 
                ? 'Unlimited access to all sources'
                : `${currentEnabled}/${limit} ${currentType} sources enabled`
              }
            </Text>
          </View>
        </View>
        {!isPremium && (
          <Text style={styles.upgradeText}>Upgrade</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <TabScreenWrapper>
      <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'news' && styles.activeTab]}
          onPress={() => setActiveTab('news')}
        >
          <Text style={[styles.tabText, activeTab === 'news' && styles.activeTabText]}>
            News Sources
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'youtube' && styles.activeTab]}
          onPress={() => setActiveTab('youtube')}
        >
          <Text style={[styles.tabText, activeTab === 'youtube' && styles.activeTabText]}>
            YouTube Channels
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'podcasts' && styles.activeTab]}
          onPress={() => setActiveTab('podcasts')}
        >
          <Text style={[styles.tabText, activeTab === 'podcasts' && styles.activeTabText]}>
            Podcasts
          </Text>
        </TouchableOpacity>
      </View>

      {renderSubscriptionBanner()}

      {activeTab === 'news' ? (
        <View style={styles.content}>
          <Text style={styles.description}>
            Enable or disable news sources to customize your feed
          </Text>
          
          <FlatList
            data={[...enabledFeeds].sort((a, b) => a.name.localeCompare(b.name))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.feedItem} testID={`feed-item-${item.id}`}>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedName}>{item.name}</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleFeed(item.id, 'news')}
                  trackColor={{ false: "#ccc", true: Colors.light.primary }}
                  thumbColor="#fff"
                  testID={`feed-switch-${item.id}`}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : activeTab === 'youtube' ? (
        <View style={styles.content}>
          <Text style={styles.description}>
            Enable or disable YouTube channels to customize your video feed
          </Text>
          
          <FlatList
            data={[...enabledChannels].sort((a, b) => a.name.localeCompare(b.name))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.feedItem} testID={`channel-item-${item.id}`}>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedName}>{item.name}</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleFeed(item.id, 'youtube')}
                  trackColor={{ false: "#ccc", true: Colors.light.primary }}
                  thumbColor="#fff"
                  testID={`channel-switch-${item.id}`}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.description}>
            Enable or disable podcasts to customize your podcast feed
          </Text>
          
          <FlatList
            data={[...enabledPodcasts].sort((a, b) => a.name.localeCompare(b.name))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.feedItem} testID={`podcast-item-${item.id}`}>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedName}>{item.name}</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleFeed(item.id, 'podcasts')}
                  trackColor={{ false: "#ccc", true: Colors.light.primary }}
                  thumbColor="#fff"
                  testID={`podcast-switch-${item.id}`}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}
      </View>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.placeholder,
  },
  activeTabText: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.light.placeholder,
    marginBottom: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  feedInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  feedLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 4,
  },
  feedLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: Colors.light.placeholder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  feedLogoPlaceholderText: {
    color: "#fff",
    fontWeight: "bold",
  },
  feedName: {
    fontSize: 16,
    color: Colors.light.text,
  },
  channelInfo: {
    flex: 1,
  },
  channelDescription: {
    fontSize: 12,
    color: Colors.light.placeholder,
    marginTop: 2,
  },
  subscriptionBanner: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumBanner: {
    backgroundColor: '#F8F9FF',
    borderBottomColor: Colors.light.primary,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerText: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  premiumBannerTitle: {
    color: Colors.light.primary,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: Colors.light.placeholder,
    marginTop: 2,
  },
  upgradeText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: 'bold',
  },
});