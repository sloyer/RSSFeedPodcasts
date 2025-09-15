import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { Bookmark, ArrowLeft, ExternalLink } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { useNewsStore } from "@/hooks/use-news-store";
import Colors from "@/constants/colors";
import EmptyState from "@/components/EmptyState";

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, bookmarks, toggleBookmark } = useNewsStore();
  const [article, setArticle] = useState(() => {
    return articles.find(a => a.id === id) || bookmarks.find(b => b.id === id);
  });

  useEffect(() => {
    if (!article) {
      // Try to find the article in the updated lists
      const foundArticle = articles.find(a => a.id === id) || bookmarks.find(b => b.id === id);
      if (foundArticle) {
        setArticle(foundArticle);
      }
    }
  }, [id, articles, bookmarks, article]);

  const handleBookmarkPress = useCallback(() => {
    if (article) {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      toggleBookmark(article.id);
      // Update local state to reflect bookmark change
      setArticle(prev => prev ? { ...prev, isBookmarked: !prev.isBookmarked } : undefined);
    }
  }, [article, toggleBookmark]);

  const handleOpenLink = useCallback(() => {
    if (article && article.link) {
      router.push({
        pathname: '/browser',
        params: {
          url: encodeURIComponent(article.link),
          title: encodeURIComponent(article.title),
        },
      });
    }
  }, [article]);

  if (!article) {
    return (
      <EmptyState
        type="error"
        message="Article not found. It may have been removed or is no longer available."
        onRefresh={() => router.back()}
      />
    );
  }

  const formattedDate = new Date(article.publishDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Clean up HTML content if available
  const cleanContent = article.content
    ? article.content
        .replace(/<(?:.|\n)*?>/gm, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
        .replace(/&amp;/g, '&') // Replace &amp; with &
        .replace(/&lt;/g, '<') // Replace &lt; with <
        .replace(/&gt;/g, '>') // Replace &gt; with >
    : article.description;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleBookmarkPress}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Bookmark
            size={24}
            color="#fff"
            fill={article.isBookmarked ? "#fff" : "transparent"}
          />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {article.imageUrl ? (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{article.source.name.charAt(0)}</Text>
          </View>
        )}
        
        <View style={styles.content}>
          <View style={styles.sourceContainer}>
            {article.source.logo ? (
              <Image
                source={{ uri: article.source.logo }}
                style={styles.sourceLogo}
                contentFit="contain"
              />
            ) : null}
            <Text style={styles.sourceName}>{article.source.name}</Text>
          </View>
          
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
          
          <Text style={styles.articleContent}>{cleanContent}</Text>
          
          <TouchableOpacity style={styles.readMoreButton} onPress={handleOpenLink}>
            <Text style={styles.readMoreText}>Read Full Article</Text>
            <ExternalLink size={16} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  image: {
    height: 300,
    width: "100%",
    backgroundColor: Colors.light.placeholder,
  },
  placeholderImage: {
    height: 300,
    width: "100%",
    backgroundColor: Colors.light.placeholder,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#fff",
  },
  content: {
    padding: 16,
  },
  sourceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sourceLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  sourceName: {
    fontSize: 16,
    color: Colors.light.placeholder,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: Colors.light.placeholder,
    marginBottom: 24,
  },
  articleContent: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
  },
  readMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 12,
  },
  readMoreText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    marginRight: 8,
  },
});