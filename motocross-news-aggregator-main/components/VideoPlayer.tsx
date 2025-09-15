import React, { useState, useRef } from "react";
import { StyleSheet, View, TouchableOpacity, Text, Platform } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react-native";
import { WebView } from "react-native-webview";

import Colors from "@/constants/colors";

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  thumbnailUrl?: string;
  onFullscreen?: () => void;
  embedUrl?: string;
  embedHtml?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, title, thumbnailUrl, onFullscreen, embedUrl, embedHtml }) => {
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const [showControls, setShowControls] = useState(true);
  const [isYouTubeVideo, setIsYouTubeVideo] = useState(() => {
    return videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || embedUrl?.includes('youtube.com');
  });
  const videoRef = useRef<Video>(null);

  const handlePlayPress = () => {
    if (!isYouTubeVideo) {
      // For non-YouTube videos, try to play directly
      if (status.isLoaded) {
        if (status.isPlaying) {
          videoRef.current?.pauseAsync();
        } else {
          videoRef.current?.playAsync();
        }
      }
    }
    // For YouTube videos, do nothing - let the embedded player handle it
  };

  const toggleMute = () => {
    if (status.isLoaded && !isYouTubeVideo) {
      videoRef.current?.setIsMutedAsync(!status.isMuted);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getVideoId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };

  if (isYouTubeVideo) {
    // For YouTube videos, use a cleaner embedded player with restricted navigation
    const videoId = getVideoId(videoUrl);
    const embedVideoUrl = embedUrl || `https://www.youtube.com/embed/${videoId}?playsinline=1&autoplay=0&rel=0&modestbranding=1&controls=1&fs=0&disablekb=1`;
    
    return (
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <View
            style={styles.webview}
            // @ts-ignore - Web-only property
            dangerouslySetInnerHTML={{
              __html: `<iframe
                src="${embedVideoUrl}"
                style="width: 100%; height: 100%; border: none;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                frameborder="0">
              </iframe>`
            }}
          />
        ) : (
          <WebView
            source={{ uri: embedVideoUrl }}
            style={styles.webview}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            scalesPageToFit={false}
            mixedContentMode="compatibility"
            bounces={false}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            nestedScrollEnabled={false}
            onShouldStartLoadWithRequest={(request) => {
              // Block navigation to YouTube.com to keep users in the app
              if (request.url.includes('youtube.com') && !request.url.includes('/embed/')) {
                return false;
              }
              return true;
            }}
            originWhitelist={['*']}
            allowsFullscreenVideo={true}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
          />
        )}
      </View>
    );
  }

  // For non-YouTube videos, use the regular video player
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUrl }}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          onPlaybackStatusUpdate={setStatus}
          onError={(error) => {
            console.error('Video playback error:', error);
            setIsYouTubeVideo(true);
          }}
        />
        
        {showControls && (
          <View style={styles.controls}>
            {!isYouTubeVideo && (
              <View style={styles.centerControls}>
                <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
                  {status.isLoaded && status.isPlaying ? (
                    <Pause size={32} color="#fff" fill="#fff" />
                  ) : (
                    <Play size={32} color="#fff" fill="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.bottomControls}>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      {
                        width: status.isLoaded && status.durationMillis
                          ? `${(status.positionMillis! / status.durationMillis) * 100}%`
                          : '0%'
                      }
                    ]}
                  />
                </View>
                <Text style={styles.timeText}>
                  {status.isLoaded 
                    ? `${formatTime(status.positionMillis || 0)} / ${formatTime(status.durationMillis || 0)}`
                    : '0:00 / 0:00'
                  }
                </Text>
              </View>
              
              <View style={styles.rightControls}>
                <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                  {status.isLoaded && status.isMuted ? (
                    <VolumeX size={20} color="#fff" />
                  ) : (
                    <Volume2 size={20} color="#fff" />
                  )}
                </TouchableOpacity>
                
                {onFullscreen && (
                  <TouchableOpacity style={styles.controlButton} onPress={onFullscreen}>
                    <Maximize size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    overflow: "hidden",
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
  },

  controls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "space-between",
  },

  centerControls: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
  },
  rightControls: {
    flexDirection: "row",
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default VideoPlayer;