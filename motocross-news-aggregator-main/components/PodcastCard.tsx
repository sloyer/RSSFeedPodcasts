import { Image } from "expo-image";
import { Play, Bookmark, CheckCircle, PlayCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated } from "react-native";

import { PodcastEpisode } from "@/types/podcast";
import { usePodcastPlayer } from "@/hooks/use-podcast-player";
import Colors from "@/constants/colors";

interface PodcastCardProps {
  episode: PodcastEpisode;
  onBookmarkPress?: (episodeId: string) => void;
}

const PodcastCard: React.FC<PodcastCardProps> = ({ episode, onBookmarkPress }) => {
  const { controls, playbackState, isEpisodeListened, getEpisodeProgress, formatTime, togglePlayPause, continueFromSavedPosition } = usePodcastPlayer();
  const [isListened, setIsListened] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ position: number; duration: number; progressPercent: number } | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [scaleAnim] = useState(new Animated.Value(1));
  
  const formattedDate = new Date(episode.publishDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Use the same ID format as the player hook for consistency
  const currentEpisodeId = playbackState.currentEpisode ? `${playbackState.currentEpisode.source.name}-${playbackState.currentEpisode.title}` : null;
  const thisEpisodeId = `${episode.source.name}-${episode.title}`;
  const isCurrentEpisode = currentEpisodeId === thisEpisodeId;
  const isPlaying = isCurrentEpisode && playbackState.isPlaying;

  // Load episode status on mount and when episode changes
  useEffect(() => {
    const loadEpisodeStatus = async () => {
      try {
        const [listened, progressData] = await Promise.all([
          isEpisodeListened(episode),
          getEpisodeProgress(episode)
        ]);
        setIsListened(listened);
        setProgress(progressData);
      } catch (error) {
        console.error('Failed to load episode status:', error);
      }
    };

    loadEpisodeStatus();
  }, [episode, isEpisodeListened, getEpisodeProgress]);

  // Update listened status and progress when playback changes
  useEffect(() => {
    if (isCurrentEpisode && playbackState.duration > 0) {
      const progressPercent = playbackState.position / playbackState.duration;
      
      // Update progress for current episode
      if (playbackState.position > 5000) { // More than 5 seconds
        setProgress({
          position: playbackState.position,
          duration: playbackState.duration,
          progressPercent,
        });
      }
      
      // Mark as listened when 95% complete
      if (progressPercent >= 0.95 && !isListened) {
        setIsListened(true);
        setProgress(null); // Clear progress when marked as listened
      }
    }
  }, [isCurrentEpisode, playbackState.position, playbackState.duration, isListened]);

  // Subtle pulse animation for continue state
  useEffect(() => {
    if (progress && progress.progressPercent < 0.95 && !isCurrentEpisode) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [progress, isCurrentEpisode, pulseAnim]);

  // Scale animation for press feedback
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    try {
      if (!episode.audioUrl) {
        console.log('No audio URL available for episode:', episode.title);
        return;
      }

      if (isCurrentEpisode) {
        await togglePlayPause();
      } else {
        // Check if episode has saved progress and continue from there
        if (progress && progress.progressPercent < 0.95 && progress.position > 5000) {
          console.log('Episode has saved progress, continuing from:', formatTime(progress.position));
          await continueFromSavedPosition(episode);
        } else {
          // Load and play the new episode from the beginning
          console.log('Loading episode from beginning:', episode.title);
          await controls.loadAndPlay(episode);
        }
      }
    } catch (error) {
      console.error('Failed to play episode:', error);
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="podcast-card"
      >
        <View style={[
          styles.card,
          progress && progress.progressPercent < 0.95 && !isCurrentEpisode && styles.cardWithProgress
        ]}>
        <View style={styles.imageContainer}>
          {episode.imageUrl ? (
            <Image
              source={{ uri: episode.imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>{episode.source.name.charAt(0)}</Text>
            </View>
          )}
          <View style={[
            styles.playOverlay,
            isPlaying && styles.playingOverlay,
            progress && progress.progressPercent < 0.95 && !isCurrentEpisode && styles.continueOverlay
          ]}>
            {playbackState.isLoading && isCurrentEpisode ? (
              <View style={styles.loadingSpinner} />
            ) : isPlaying ? (
              <View style={styles.playingIndicator} />
            ) : progress && progress.progressPercent < 0.95 && !isCurrentEpisode ? (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <PlayCircle size={28} color="#fff" fill={Colors.light.primary} />
              </Animated.View>
            ) : (
              <Play size={20} color="#fff" fill="#fff" />
            )}
          </View>
          {onBookmarkPress && (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={(e) => {
                e.stopPropagation();
                onBookmarkPress(episode.id);
              }}
              activeOpacity={0.7}
              testID="bookmark-button"
            >
              <Bookmark
                size={16}
                color={episode.isBookmarked ? Colors.light.primary : "#fff"}
                fill={episode.isBookmarked ? Colors.light.primary : "transparent"}
              />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.content}>
          <View style={styles.sourceContainer}>
            <Text style={styles.sourceName}>{episode.source.name}</Text>
          </View>
          
          <Text style={styles.title} numberOfLines={2}>
            {episode.title}
          </Text>
          
          <Text style={styles.description} numberOfLines={2}>
            {episode.description}
          </Text>
          
          <View style={styles.metaContainer}>
            <Text style={styles.date}>{formattedDate}</Text>
            <View style={styles.statusContainer}>
              {isListened && (
                <View style={styles.statusBadge}>
                  <CheckCircle size={12} color={Colors.light.success} />
                  <Text style={styles.statusText}>Listened</Text>
                </View>
              )}
              {!isListened && !progress && (
                <Text style={styles.tapHint}>
                  {isCurrentEpisode ? (isPlaying ? 'Playing' : 'Paused') : 'Tap to play'}
                </Text>
              )}
            </View>
          </View>
          
          {/* Clean progress indicator for episodes with saved progress */}
          {!isListened && progress && progress.progressPercent < 0.95 && (
            <View style={styles.progressSection}>
              <View style={styles.progressInfo}>
                <View style={styles.continueLabel}>
                  <PlayCircle size={12} color={Colors.light.primary} />
                  <Text style={styles.continueText}>
                    Continue from {formatTime(progress.position)}
                  </Text>
                </View>
                <Text style={styles.progressPercent}>
                  {Math.round(progress.progressPercent * 100)}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(progress.progressPercent * 100, 100)}%` }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  touchable: {
    borderRadius: 12,
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
    flexDirection: "row",
  },
  cardWithProgress: {
    borderWidth: 1,
    borderColor: Colors.light.primary + '20',
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.15,
  },
  imageContainer: {
    position: "relative",
    width: 100,
    height: 100,
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.light.placeholder,
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.light.placeholder,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  playOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  playingOverlay: {
    backgroundColor: Colors.light.primary,
  },
  continueOverlay: {
    backgroundColor: Colors.light.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    transform: [{ translateX: -18 }, { translateY: -18 }],
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  loadingSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    borderTopColor: "transparent",
  },
  playingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  bookmarkButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  sourceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sourceName: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: "600",
  },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: Colors.light.placeholder,
    lineHeight: 16,
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: {
    fontSize: 12,
    color: Colors.light.placeholder,
  },
  tapHint: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statusText: {
    fontSize: 10,
    color: Colors.light.text,
    fontWeight: "500",
  },
  progressSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border + '40',
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  continueLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  continueText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 11,
    color: Colors.light.placeholder,
    fontWeight: "500",
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.light.border + '60',
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },
});

export default PodcastCard;