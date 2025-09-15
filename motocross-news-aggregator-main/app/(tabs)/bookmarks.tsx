import { FlatList, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";

import ArticleCard from "@/components/ArticleCard";
import VideoCard from "@/components/VideoCard";
import PodcastCard from "@/components/PodcastCard";
import EmptyState from "@/components/EmptyState";
import TabScreenWrapper from "@/components/TabScreenWrapper";
import { useNewsStore } from "@/hooks/use-news-store";
import { useYouTubeStore } from "@/hooks/use-youtube-store";
import { usePodcastStore } from "@/hooks/use-podcast-store";
import Colors from "@/constants/colors";
import { router } from "expo-router";

type BookmarkType = 'all' | 'articles' | 'videos' | 'podcasts';

export default function BookmarksScreen() {
  const { bookmarks: articleBookmarks, toggleBookmark: toggleArticleBookmark } = useNewsStore();
  const { bookmarks: videoBookmarks, toggleBookmark: toggleVideoBookmark } = useYouTubeStore();
  const { bookmarks: podcastBookmarks, toggleBookmark: togglePodcastBookmark } = usePodcastStore();
  const [selectedType, setSelectedType] = useState<BookmarkType>('all');

  const totalBookmarks = articleBookmarks.length + videoBookmarks.length + podcastBookmarks.length;

  const handleVideoPress = (video: any) => {
    router.push(`/video/${video.id}?title=${encodeURIComponent(video.title)}&url=${encodeURIComponent(video.videoUrl)}`);
  };

  const getFilteredData = () => {
    const allItems: Array<{ type: string; data: any }> = [];
    
    if (selectedType === 'all' || selectedType === 'articles') {
      articleBookmarks.forEach(item => allItems.push({ type: 'article', data: item }));
    }
    if (selectedType === 'all' || selectedType === 'videos') {
      videoBookmarks.forEach(item => allItems.push({ type: 'video', data: item }));
    }
    if (selectedType === 'all' || selectedType === 'podcasts') {
      podcastBookmarks.forEach(item => allItems.push({ type: 'podcast', data: item }));
    }
    
    // Sort by date (newest first)
    return allItems.sort((a, b) => {
      const dateA = new Date(a.data.publishDate || a.data.publishedAt || 0).getTime();
      const dateB = new Date(b.data.publishDate || b.data.publishedAt || 0).getTime();
      return dateB - dateA;
    });
  };

  const filteredData = getFilteredData();

  const renderFilterButton = (type: BookmarkType, label: string, count: number) => {
    const isSelected = selectedType === type;
    return (
      <TouchableOpacity
        style={[styles.filterButton, isSelected && styles.filterButtonActive]}
        onPress={() => setSelectedType(type)}
        testID={`filter-${type}`}
      >
        <Text style={[styles.filterButtonText, isSelected && styles.filterButtonTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: { type: string; data: any } }) => {
    switch (item.type) {
      case 'article':
        return (
          <ArticleCard
            article={item.data}
            onBookmarkPress={toggleArticleBookmark}
          />
        );
      case 'video':
        return (
          <VideoCard
            video={item.data}
            onPress={handleVideoPress}
            onBookmarkPress={toggleVideoBookmark}
          />
        );
      case 'podcast':
        return (
          <PodcastCard
            episode={item.data}
            onBookmarkPress={togglePodcastBookmark}
          />
        );
      default:
        return null;
    }
  };

  if (totalBookmarks === 0) {
    return (
      <TabScreenWrapper>
        <EmptyState
          type="empty"
          message="You haven't bookmarked anything yet. Tap the bookmark icon on articles, videos, or podcasts to save them for later."
          onRefresh={undefined}
        />
      </TabScreenWrapper>
    );
  }

  return (
    <TabScreenWrapper>
      <View style={styles.container}>
        <View style={styles.filterContainer}>
          {renderFilterButton('all', 'All', totalBookmarks)}
          {renderFilterButton('articles', 'Articles', articleBookmarks.length)}
          {renderFilterButton('videos', 'Videos', videoBookmarks.length)}
          {renderFilterButton('podcasts', 'Podcasts', podcastBookmarks.length)}
        </View>
        
        {filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {selectedType === 'all' ? '' : selectedType} bookmarks found.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => `${item.type}-${item.data.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            testID="bookmarks-list"
          />
        )}
      </View>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.light.cardBackground,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.placeholder,
    textAlign: 'center',
  },
});