import { Image } from "expo-image";
import { Play, Bookmark } from "lucide-react-native";
import React, { memo, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { YouTubeVideo } from "@/types/youtube";
import Colors from "@/constants/colors";

interface VideoCardProps {
  video: YouTubeVideo;
  onPress: (video: YouTubeVideo) => void;
  onBookmarkPress?: (videoId: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = memo(({ video, onPress, onBookmarkPress }) => {
  const formattedDate = React.useMemo(() => {
    return new Date(video.publishedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [video.publishedAt]);
  
  const handlePress = useCallback(() => {
    console.log(`🎬 [PERFORMANCE] Video card pressed: ${video.title}`);
    onPress(video);
  }, [video, onPress]);
  
  const handleBookmarkPress = useCallback((e: any) => {
    e.stopPropagation();
    console.log(`🔖 [PERFORMANCE] Bookmark pressed: ${video.id}`);
    onBookmarkPress?.(video.id);
  }, [video.id, onBookmarkPress]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID="video-card"
    >
      <View style={styles.card}>
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            priority="normal"
          />
          <View style={styles.playButton}>
            <Play size={24} color="#fff" fill="#fff" />
          </View>
          {onBookmarkPress && (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={handleBookmarkPress}
              activeOpacity={0.7}
              testID="bookmark-button"
            >
              <Bookmark
                size={20}
                color={video.isBookmarked ? Colors.light.primary : "#fff"}
                fill={video.isBookmarked ? Colors.light.primary : "transparent"}
              />
            </TouchableOpacity>
          )}
          {video.duration !== 'N/A' && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{video.duration}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          
          <Text style={styles.channelName}>{video.channelName}</Text>
          
          <View style={styles.metaContainer}>
            <Text style={styles.metaText}>{formattedDate}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

VideoCard.displayName = 'VideoCard';

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
  thumbnailContainer: {
    position: "relative",
    height: 200,
    width: "100%",
  },
  thumbnail: {
    height: "100%",
    width: "100%",
    backgroundColor: Colors.light.placeholder,
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 14,
    color: Colors.light.placeholder,
    fontWeight: "500",
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.placeholder,
  },
});

export default VideoCard;