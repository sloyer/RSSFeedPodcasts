import { useCallback, useState, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { ChevronDown, X } from "lucide-react-native";

import PodcastCard from "@/components/PodcastCard";
import EmptyState from "@/components/EmptyState";
import TabScreenWrapper from "@/components/TabScreenWrapper";
import DetailedLoadingIndicator from "@/components/DetailedLoadingIndicator";

import { usePodcastStore } from "@/hooks/use-podcast-store";
import Colors from "@/constants/colors";
import { useSubscription } from "@/hooks/use-subscription";

export default function PodcastsScreen() {
  const { 
    episodes, 
    allEpisodes,
    currentPage,
    isLoading, 
    isLoadingMore, 
    isError, 
    hasMore,
    enabledPodcasts,
    loadingProgress,
    refreshPodcasts, 
    loadMoreEpisodes,
    toggleBookmark
  } = usePodcastStore();

  const EPISODES_PER_PAGE = 10;
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(null);
  const [showPodcastFilter, setShowPodcastFilter] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPodcasts();
    setRefreshing(false);
  }, [refreshPodcasts]);

  // Filter episodes by selected podcast (only for premium users)
  const filteredEpisodes = useMemo(() => {
    console.log(`🔍 Filtering episodes. isPremium: ${isPremium}, selectedPodcastId: ${selectedPodcastId}, allEpisodes: ${allEpisodes.length}`);
    
    if (!isPremium || !selectedPodcastId) {
      console.log('📺 Showing all episodes (no filter)');
      const sourceData = allEpisodes;
      return sourceData.slice(0, currentPage * EPISODES_PER_PAGE);
    }
    
    const filteredData = allEpisodes.filter(episode => {
      const matches = episode.source.id === selectedPodcastId;
      if (matches) {
        console.log(`✅ Episode matches filter: ${episode.title} (source.id: ${episode.source.id})`);
      }
      return matches;
    });
    
    console.log(`🔍 Filtered ${allEpisodes.length} episodes down to ${filteredData.length} for podcast ID: ${selectedPodcastId}`);
    
    // Apply pagination to filtered data
    return filteredData.slice(0, currentPage * EPISODES_PER_PAGE);
  }, [allEpisodes, selectedPodcastId, isPremium, currentPage]);

  // Calculate hasMore based on filtered data
  const filteredHasMore = useMemo(() => {
    const sourceData = !isPremium || !selectedPodcastId ? allEpisodes : allEpisodes.filter(episode => episode.source.id === selectedPodcastId);
    return filteredEpisodes.length < sourceData.length;
  }, [allEpisodes, selectedPodcastId, isPremium, filteredEpisodes.length]);

  const handleLoadMore = useCallback(() => {
    if (filteredHasMore && !isLoadingMore) {
      loadMoreEpisodes();
    }
  }, [filteredHasMore, isLoadingMore, loadMoreEpisodes]);

  const handlePodcastSelect = useCallback((podcastId: string | null) => {
    setSelectedPodcastId(podcastId);
    setShowPodcastFilter(false);
    // Scroll to top when filter changes
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  const selectedPodcastName = useMemo(() => {
    if (!selectedPodcastId) return "All Podcasts";
    return enabledPodcasts.find(p => p.id === selectedPodcastId)?.name || "All Podcasts";
  }, [selectedPodcastId, enabledPodcasts]);

  const enabledPodcastOptions = useMemo(() => {
    return enabledPodcasts.filter(p => p.enabled);
  }, [enabledPodcasts]);

  const renderFooter = useCallback(() => {
    if (!filteredHasMore && filteredEpisodes.length > 0) {
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
          <Text style={styles.footerLoadingText}>Loading more episodes...</Text>
        </View>
      );
    }

    return <View style={styles.footerSpacing} />;
  }, [filteredHasMore, isLoadingMore, filteredEpisodes.length]);

  if (isLoading && !refreshing) {
    return (
      <TabScreenWrapper>
        <DetailedLoadingIndicator
          loadingProgress={loadingProgress}
          totalFeeds={enabledPodcasts.filter(p => p.enabled).length}
          contentType="podcasts"
        />
      </TabScreenWrapper>
    );
  }

  if (isError) {
    return (
      <TabScreenWrapper>
        <EmptyState
          type="error"
          message="The podcast service is currently experiencing issues. This appears to be a temporary backend problem. Please try again later."
          onRefresh={refreshPodcasts}
        />
      </TabScreenWrapper>
    );
  }

  if (allEpisodes.length === 0) {
    return (
      <TabScreenWrapper>
        <EmptyState
          type="support"
          message="No podcast episodes are currently available."
        />
      </TabScreenWrapper>
    );
  }

  return (
    <TabScreenWrapper>
      <View style={styles.container}>
        {/* Podcast Filter - Only show for premium users */}
        {isPremium && enabledPodcastOptions.length > 1 && (
          <View style={styles.filterContainer}>
            <TouchableOpacity 
              style={styles.filterButton} 
              onPress={() => setShowPodcastFilter(true)}
              testID="podcast-filter-button"
            >
              <Text style={styles.filterButtonText}>{selectedPodcastName}</Text>
              <ChevronDown size={16} color={Colors.light.text} />
            </TouchableOpacity>
            {selectedPodcastId && (
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={() => handlePodcastSelect(null)}
                testID="reset-filter-button"
              >
                <X size={16} color={Colors.light.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <FlatList
          ref={flatListRef}
          data={filteredEpisodes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PodcastCard 
              episode={item} 
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
        testID="podcasts-list"
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={15}
        initialNumToRender={8}
          getItemLayout={(data, index) => ({
            length: 200, // Approximate height of PodcastCard
            offset: 200 * index,
            index,
          })}
        />
        
        {/* Podcast Filter Modal */}
        <Modal
          visible={showPodcastFilter}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPodcastFilter(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowPodcastFilter(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter by Podcast</Text>
                <TouchableOpacity onPress={() => setShowPodcastFilter(false)}>
                  <X size={24} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.podcastList}>
                <TouchableOpacity
                  style={[
                    styles.podcastOption,
                    !selectedPodcastId && styles.podcastOptionSelected
                  ]}
                  onPress={() => handlePodcastSelect(null)}
                >
                  <Text style={[
                    styles.podcastOptionText,
                    !selectedPodcastId && styles.podcastOptionTextSelected
                  ]}>All Podcasts</Text>
                </TouchableOpacity>
                
                {enabledPodcastOptions.sort((a, b) => a.name.localeCompare(b.name)).map((podcast) => (
                  <TouchableOpacity
                    key={podcast.id}
                    style={[
                      styles.podcastOption,
                      selectedPodcastId === podcast.id && styles.podcastOptionSelected
                    ]}
                    onPress={() => handlePodcastSelect(podcast.id)}
                  >
                    <Text style={[
                      styles.podcastOptionText,
                      selectedPodcastId === podcast.id && styles.podcastOptionTextSelected
                    ]}>{podcast.name}</Text>
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
  podcastList: {
    maxHeight: 300,
  },
  podcastOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  podcastOptionSelected: {
    backgroundColor: Colors.light.primary + '10',
  },
  podcastOptionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  podcastOptionTextSelected: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
});