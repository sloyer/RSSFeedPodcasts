import { Image } from "expo-image";
import { Bookmark } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as WebBrowser from 'expo-web-browser';

import { Article } from "@/types/article";
import Colors from "@/constants/colors";

interface ArticleCardProps {
  article: Article;
  onBookmarkPress: (articleId: string) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onBookmarkPress }) => {
  const formattedDate = new Date(article.publishDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Parse imageUrl if it's a JSON array string
  const getImageUrl = () => {
    if (!article.imageUrl) return '';
    if (article.imageUrl.startsWith('[') && article.imageUrl.endsWith(']')) {
      const parsed = JSON.parse(article.imageUrl);
      return parsed[0];
    }
    return article.imageUrl;
  };

  const imageUrl = getImageUrl();

  const handlePress = async () => {
    if (!article.link || typeof article.link !== 'string') {
      console.warn('Invalid article link:', article.link);
      return;
    }
    
    try {
      // Validate URL before opening
      new URL(article.link);
      
      console.log('📰 Opening article:', {
        title: article.title,
        source: article.source.name,
        url: article.link
      });
      
      // Open in native Safari popup within the app
      await WebBrowser.openBrowserAsync(article.link, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: Colors.light.primary,
        showTitle: true,
        enableBarCollapsing: true,
        showInRecents: false,
      });
    } catch (error) {
      console.error('Error opening article:', article.link, error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID="article-card"
    >
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.mainImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              priority="high"
              recyclingKey={article.id}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>{article.source.name}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.content}>
          <View style={styles.sourceContainer}>
            <Text style={styles.sourceName}>{article.source.name}</Text>
            {article.author && (
              <Text style={styles.author}>By: {article.author}</Text>
            )}
          </View>
          
          <Text style={styles.title} numberOfLines={2}>
            {article.title}
          </Text>
          
          <Text style={styles.date}>{formattedDate}</Text>
          
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={() => onBookmarkPress(article.id)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Bookmark
              size={20}
              color={article.isBookmarked ? Colors.light.primary : Colors.light.placeholder}
              fill={article.isBookmarked ? Colors.light.primary : "transparent"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    height: 180,
    width: "100%",
    position: 'relative',
  },
  placeholderImage: {
    height: 180,
    width: "100%",
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.placeholder,
  },
  mainImage: {
    height: 180,
    width: "100%",
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  sourceContainer: {
    marginBottom: 8,
  },
  sourceName: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "500",
  },
  author: {
    fontSize: 13,
    color: Colors.light.placeholder,
    fontWeight: "400",
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
  },

  date: {
    fontSize: 14,
    color: Colors.light.placeholder,
  },
  bookmarkButton: {
    position: "absolute",
    top: 16,
    right: 16,
  },
});

export default ArticleCard;