import { useCallback, useState, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { AlertTriangle, Settings, ChevronDown, X } from "lucide-react-native";

import VideoCard from "@/components/VideoCard";
import EmptyState from "@/components/EmptyState";
import TabScreenWrapper from "@/components/TabScreenWrapper";
import DetailedLoadingIndicator from "@/components/DetailedLoadingIndicator";

import { useYouTubeStore } from "@/hooks/use-youtube-store";
import { YouTubeVideo } from "@/types/youtube";
import Colors from "@/constants/colors";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";

export default function YouTubeScreen() {
  const { 
    videos, 
    allVideos,
    currentPage,
    isLoading, 
    isLoadingMore, 
    isError, 
    hasMore, 
    errorMessage,
    enabledChannels,
    loadingProgress,
    refreshVideos, 
    loadMoreVideos,
    toggleBookmark
  } = useYouTubeStore();

  const VIDEOS_PER_PAGE = 10;
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showChannelFilter, setShowChannelFilter] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshVideos();
    setRefreshing(false);
  }, [refreshVideos]);

  const handleVideoPress = useCallback((video: YouTubeVideo) => {
    console.log(`🎬 [PERFORMANCE] Navigating to video: ${video.title}`);
    const params = new URLSearchParams({
      title: video.title,
      url: video.watchUrl,
      embedUrl: video.embedUrl,
      thumbnailUrl: video.thumbnailUrl,
      description: video.description,
      channelName: video.channelName,
      publishedAt: video.publishedAt,
    });
    router.push(`/video/${video.id}?${params.toString()}`);
  }, []);

  const handleSettingsPress = useCallback(() => {
    router.push('/(tabs)/settings');
  }, []);

  // Filter videos by selected channel (only for premium users)
  const filteredVideos = useMemo(() => {
    const sourceData = !isPremium || !selectedChannelId ? allVideos : allVideos.filter(video => video.channelName === enabledChannels.find(c => c.id === selectedChannelId)?.name);
    // Apply pagination to filtered data
    return sourceData.slice(0, currentPage * VIDEOS_PER_PAGE);
  }, [allVideos, selectedChannelId, isPremium, enabledChannels, currentPage]);

  // Calculate hasMore based on filtered data
  const filteredHasMore = useMemo(() => {
    const sourceData = !isPremium || !selectedChannelId ? allVideos : allVideos.filter(video => video.channelName === enabledChannels.find(c => c.id === selectedChannelId)?.name);
    return filteredVideos.length < sourceData.length;
  }, [allVideos, selectedChannelId, isPremium, enabledChannels, filteredVideos.length]);

  const handleLoadMore = useCallback(() => {
    if (filteredHasMore && !isLoadingMore) {
      loadMoreVideos();
    }
  }, [filteredHasMore, isLoadingMore, loadMoreVideos]);

  const handleChannelSelect = useCallback((channelId: string | null) => {
    setSelectedChannelId(channelId);
    setShowChannelFilter(false);
    // Scroll to top when filter changes
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  const selectedChannelName = useMemo(() => {
    if (!selectedChannelId) return "All Channels";
    return enabledChannels.find(c => c.id === selectedChannelId)?.name || "All Channels";
  }, [selectedChannelId, enabledChannels]);

  const enabledChannelOptions = useMemo(() => {
    return enabledChannels.filter(c => c.enabled);
  }, [enabledChannels]);

  const renderFooter = useCallback(() => {
    if (!filteredHasMore && filteredVideos.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>You've reached the end!</Text>
        </View>
      );
    }

    if (isLoadingMore) {
      return (
        <View style={styles.footerContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.footerLoadingText}>Loading more videos...</Text>
        </View>
      );
    }

    return <View style={styles.footerSpacing} />;
  }, [filteredHasMore, isLoadingMore, filteredVideos.length]);

  if (isLoading && !refreshing && videos.length === 0) {
    return (
      <TabScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading videos...</Text>
        </View>
      </TabScreenWrapper>
    );
  }

  if (isError) {
    const displayMessage = errorMessage || "There was an error loading the latest motocross videos. Please try again.";
    
    return (
      <TabScreenWrapper>
        <EmptyState
          type="error"
          message={displayMessage}
          onRefresh={refreshVideos}
        />
      </TabScreenWrapper>
    );
  }

  if (allVideos.length === 0) {
    return (
      <TabScreenWrapper>
        <View style={styles.container}>
          {errorMessage && (
            <View style={styles.warningBanner}>
              <AlertTriangle size={16} color="#fff" />
              <Text style={styles.warningText}>{errorMessage}</Text>
            </View>
          )}
          <EmptyState
            type="empty"
            message="No videos found. Try enabling more channels in Settings or refresh to try again."
            onRefresh={refreshVideos}
          />
        </View>
      </TabScreenWrapper>
    );
  }

  return (
    <TabScreenWrapper>
      <View style={styles.container}>
        {errorMessage && (
          <View style={styles.warningBanner}>
            <View style={styles.warningContent}>
              <AlertTriangle size={16} color="#fff" />
              <Text style={styles.warningText} numberOfLines={2}>
                {errorMessage}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSettingsPress} style={styles.settingsButton}>
              <Settings size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Channel Filter - Only show for premium users */}
        {isPremium && enabledChannelOptions.length > 1 && (
          <View style={styles.filterContainer}>
            <TouchableOpacity 
              style={styles.filterButton} 
              onPress={() => setShowChannelFilter(true)}
              testID="channel-filter-button"
            >
              <Text style={styles.filterButtonText}>{selectedChannelName}</Text>
              <ChevronDown size={16} color={Colors.light.text} />
            </TouchableOpacity>
            {selectedChannelId && (
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={() => handleChannelSelect(null)}
                testID="reset-filter-button"
              >
                <X size={16} color={Colors.light.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <FlatList
          ref={flatListRef}
          data={filteredVideos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              onPress={handleVideoPress}
              onBookmarkPress={toggleBookmark}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.light.primary]}
              tintColor={Colors.light.primary}
            />
          }
          onEndReached={filteredHasMore && !isLoadingMore ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          testID="videos-list"
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          initialNumToRender={5}
          getItemLayout={(data, index) => ({
            length: 280, // Approximate height of VideoCard
            offset: 280 * index,
            index,
          })}
        />
        
        {/* Channel Filter Modal */}
        <Modal
          visible={showChannelFilter}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowChannelFilter(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowChannelFilter(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter by Channel</Text>
                <TouchableOpacity onPress={() => setShowChannelFilter(false)}>
                  <X size={24} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.channelList}>
                <TouchableOpacity
                  style={[
                    styles.channelOption,
                    !selectedChannelId && styles.channelOptionSelected
                  ]}
                  onPress={() => handleChannelSelect(null)}
                >
                  <Text style={[
                    styles.channelOptionText,
                    !selectedChannelId && styles.channelOptionTextSelected
                  ]}>All Channels</Text>
                </TouchableOpacity>
                
                {enabledChannelOptions.sort((a, b) => a.name.localeCompare(b.name)).map((channel) => (
                  <TouchableOpacity
                    key={channel.id}
                    style={[
                      styles.channelOption,
                      selectedChannelId === channel.id && styles.channelOptionSelected
                    ]}
                    onPress={() => handleChannelSelect(channel.id)}
                  >
                    <Text style={[
                      styles.channelOptionText,
                      selectedChannelId === channel.id && styles.channelOptionTextSelected
                    ]}>{channel.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.placeholder,
    marginTop: 12,
    textAlign: "center",
  },
  listContent: {
    paddingVertical: 8,
  },
  footerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: "center",
  },
  footerLoadingText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    marginTop: 8,
    textAlign: "center",
  },
  footerSpacing: {
    height: 20,
  },
  warningBanner: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  settingsButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  resetButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  channelList: {
    maxHeight: 300,
  },
  channelOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  channelOptionSelected: {
    backgroundColor: Colors.light.primary + '10',
  },
  channelOptionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  channelOptionTextSelected: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
});