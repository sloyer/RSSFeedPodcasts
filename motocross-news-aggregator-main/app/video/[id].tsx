import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import VideoPlayer from "@/components/VideoPlayer";
import Colors from "@/constants/colors";

export default function VideoDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, title, url, embedUrl, thumbnailUrl, description, channelName, publishedAt } = useLocalSearchParams<{ 
    id: string; 
    title: string; 
    url: string;
    embedUrl?: string;
    thumbnailUrl?: string;
    description?: string;
    channelName?: string;
    publishedAt?: string;
  }>();



  const videoTitle = title ? decodeURIComponent(title) : 'Video';
  const videoUrl = url ? decodeURIComponent(url) : '';
  const videoEmbedUrl = embedUrl ? decodeURIComponent(embedUrl) : '';
  const videoThumbnailUrl = thumbnailUrl ? decodeURIComponent(thumbnailUrl) : '';
  const videoDescription = description ? decodeURIComponent(description) : '';
  const videoChannelName = channelName ? decodeURIComponent(channelName) : '';
  const videoPublishedAt = publishedAt ? decodeURIComponent(publishedAt) : '';

  // Get video ID for thumbnail (fallback)
  const getVideoId = (youtubeUrl: string): string => {
    const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  const getThumbnailUrl = (youtubeUrl: string): string => {
    // Use provided thumbnail URL first, then fallback to generated one
    if (videoThumbnailUrl) return videoThumbnailUrl;
    
    const videoId = getVideoId(youtubeUrl);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        

      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.videoContainer}>
          <VideoPlayer
            videoUrl={videoUrl}
            title={videoTitle}
            thumbnailUrl={getThumbnailUrl(videoUrl)}
            embedUrl={videoEmbedUrl}
          />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{videoTitle}</Text>
          
          {videoChannelName && (
            <View style={styles.metaContainer}>
              <Text style={styles.channelName}>{videoChannelName}</Text>
              {videoPublishedAt && (
                <Text style={styles.publishDate}>
                  {new Date(videoPublishedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>
          )}
          
          {videoDescription && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionTitle}>Description</Text>
              <Text style={styles.description}>{videoDescription}</Text>
            </View>
          )}
          

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  videoContainer: {
    width: "100%",
    height: 380,
    backgroundColor: "#000",
    marginBottom: 8,
  },
  content: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 0,
    minHeight: "60%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 16,
    lineHeight: 32,
  },

  metaContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  channelName: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.primary,
    marginBottom: 6,
  },
  publishDate: {
    fontSize: 15,
    color: Colors.light.placeholder,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
  },
});