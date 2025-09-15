import { useCallback, useState, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { ChevronDown, Filter, X } from "lucide-react-native";

import ArticleCard from "@/components/ArticleCard";
import EmptyState from "@/components/EmptyState";
import TabScreenWrapper from "@/components/TabScreenWrapper";
import DetailedLoadingIndicator from "@/components/DetailedLoadingIndicator";

import { useNewsStore } from "@/hooks/use-news-store";
import { useSubscription } from "@/hooks/use-subscription";
import Colors from "@/constants/colors";

export default function HomeScreen() {
  const { 
    articles, 
    allArticles,
    currentPage,
    isLoading, 
    isLoadingMore, 
    isError, 
    hasMore, 
    enabledFeeds,
    loadingProgress,
    refreshFeeds, 
    loadMoreArticles, 
    toggleBookmark 
  } = useNewsStore();

  const ARTICLES_PER_PAGE = 15;
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFeeds();
    setRefreshing(false);
  }, [refreshFeeds]);

  // Filter articles by selected feed (premium feature)
  const filteredArticles = useMemo(() => {
    const sourceData = !isPremium || !selectedFeedId ? allArticles : allArticles.filter(article => article.source?.id === selectedFeedId);
    // Apply pagination to filtered data
    return sourceData.slice(0, currentPage * ARTICLES_PER_PAGE);
  }, [allArticles, selectedFeedId, isPremium, currentPage]);

  // Calculate hasMore based on filtered data
  const filteredHasMore = useMemo(() => {
    const sourceData = !isPremium || !selectedFeedId ? allArticles : allArticles.filter(article => article.source?.id === selectedFeedId);
    return filteredArticles.length < sourceData.length;
  }, [allArticles, selectedFeedId, isPremium, filteredArticles.length]);

  const handleLoadMore = useCallback(() => {
    if (filteredHasMore && !isLoadingMore) {
      loadMoreArticles();
    }
  }, [filteredHasMore, isLoadingMore, loadMoreArticles]);

  // Get enabled feeds for filter dropdown
  const availableFeeds = useMemo(() => {
    return enabledFeeds.filter(feed => feed.enabled);
  }, [enabledFeeds]);

  const selectedFeed = useMemo(() => {
    return availableFeeds.find(feed => feed.id === selectedFeedId);
  }, [availableFeeds, selectedFeedId]);

  const handleFeedSelect = useCallback((feedId: string | null) => {
    setSelectedFeedId(feedId);
    setShowFilterModal(false);
    // Scroll to top when filter changes
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  const renderFilterDropdown = useCallback(() => {
    if (!isPremium || availableFeeds.length <= 1) {
      return null;
    }

    return (
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
          testID="filter-button"
        >
          <Filter size={16} color={Colors.light.primary} />
          <Text style={styles.filterButtonText}>
            {selectedFeed ? selectedFeed.name : 'All Feeds'}
          </Text>
          {selectedFeedId ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSelectedFeedId(null)}
              testID="clear-filter-button"
            >
              <X size={14} color={Colors.light.placeholder} />
            </TouchableOpacity>
          ) : (
            <ChevronDown size={16} color={Colors.light.primary} />
          )}
        </TouchableOpacity>
      </View>
    );
  }, [isPremium, availableFeeds.length, selectedFeed, selectedFeedId, setShowFilterModal]);

  const renderFilterModal = useCallback(() => {
    return (
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Feed</Text>
            <ScrollView style={styles.feedList}>
              <TouchableOpacity
                style={[
                  styles.feedOption,
                  !selectedFeedId && styles.feedOptionSelected
                ]}
                onPress={() => handleFeedSelect(null)}
              >
                <Text style={[
                  styles.feedOptionText,
                  !selectedFeedId && styles.feedOptionTextSelected
                ]}>All Feeds</Text>
              </TouchableOpacity>
              {availableFeeds.sort((a, b) => a.name.localeCompare(b.name)).map((feed) => (
                <TouchableOpacity
                  key={feed.id}
                  style={[
                    styles.feedOption,
                    selectedFeedId === feed.id && styles.feedOptionSelected
                  ]}
                  onPress={() => handleFeedSelect(feed.id)}
                >
                  <Text style={[
                    styles.feedOptionText,
                    selectedFeedId === feed.id && styles.feedOptionTextSelected
                  ]}>{feed.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }, [showFilterModal, availableFeeds, selectedFeedId, handleFeedSelect]);

  const renderFooter = useCallback(() => {
    if (!filteredHasMore) {
      return (
        <View style={styles.footerContainer}>
          {filteredArticles.length > 0 ? (
            <Text style={styles.footerText}>You've reached the end!</Text>
          ) : null}
        </View>
      );
    }

    if (isLoadingMore) {
      return (
        <View style={styles.footerContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.footerLoadingText}>Loading more articles...</Text>
        </View>
      );
    }

    return <View style={styles.footerSpacing} />;
  }, [filteredHasMore, isLoadingMore, filteredArticles.length]);

  if (isLoading && !refreshing && articles.length === 0) {
    return (
      <TabScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading articles...</Text>
        </View>
      </TabScreenWrapper>
    );
  }

  if (isError) {
    return (
      <TabScreenWrapper>
        <EmptyState
          type="error"
          message="There was an error loading the latest motocross news. Please try again."
          onRefresh={refreshFeeds}
        />
      </TabScreenWrapper>
    );
  }

  if (allArticles.length === 0) {
    return (
      <TabScreenWrapper>
        <EmptyState
          type="empty"
          message="No articles found. Try enabling more feeds in Settings or refresh to try again."
          onRefresh={refreshFeeds}
        />
      </TabScreenWrapper>
    );
  }

  if (filteredArticles.length === 0 && selectedFeedId) {
    return (
      <TabScreenWrapper>
        {renderFilterDropdown()}
        <EmptyState
          type="empty"
          message={`No articles found from ${selectedFeed?.name}. Try selecting a different feed or refresh to try again.`}
          onRefresh={refreshFeeds}
        />
        {renderFilterModal()}
      </TabScreenWrapper>
    );
  }

  return (
    <TabScreenWrapper>
      {renderFilterDropdown()}
      <FlatList
        ref={flatListRef}
        data={filteredArticles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        testID="articles-list"
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={21}
        initialNumToRender={10}
      />
      {renderFilterModal()}
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
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
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  feedList: {
    maxHeight: 300,
  },
  feedOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  feedOptionSelected: {
    backgroundColor: Colors.light.primary,
  },
  feedOptionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  feedOptionTextSelected: {
    color: Colors.light.background,
    fontWeight: '500' as const,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
  },
});