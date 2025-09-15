import { Image } from 'expo-image';
import { Play, Pause, SkipForward, SkipBack, X } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { usePodcastPlayer } from '@/hooks/use-podcast-player';
import Colors from '@/constants/colors';

interface MiniPlayerProps {
  onExpand?: () => void;
  visible?: boolean;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand, visible = true }) => {
  const { playbackState, togglePlayPause, skipForward, skipBackward, formatTime, controls } = usePodcastPlayer();

  // Don't render if not visible or no current episode
  if (!visible || !playbackState.currentEpisode) {
    return null;
  }

  const currentEpisode = playbackState.currentEpisode;
  const progress = playbackState.duration > 0 ? playbackState.position / playbackState.duration : 0;

  const handleClose = async () => {
    await controls.clearCurrentEpisode();
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      
      <TouchableOpacity 
        style={styles.content} 
        onPress={onExpand}
        activeOpacity={0.8}
        testID="mini-player"
      >
        <View style={styles.episodeInfo}>
          {currentEpisode.imageUrl ? (
            <Image
              source={{ uri: currentEpisode.imageUrl }}
              style={styles.artwork}
              contentFit="cover"
            />
          ) : (
            <View style={styles.placeholderArtwork}>
              <Text style={styles.placeholderText}>
                {currentEpisode.source.name.charAt(0)}
              </Text>
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentEpisode.title}
            </Text>
            <Text style={styles.podcast} numberOfLines={1}>
              {currentEpisode.source.name}
            </Text>
            <Text style={styles.time}>
              {formatTime(playbackState.position)} / {formatTime(playbackState.duration)}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => skipBackward(15)}
            style={styles.controlButton}
            testID="skip-backward"
          >
            <SkipBack size={20} color={Colors.light.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlayPause}
            style={[styles.controlButton, styles.playButton]}
            disabled={playbackState.isLoading}
            testID="play-pause"
          >
            {playbackState.isLoading ? (
              <View style={styles.loadingIndicator} />
            ) : playbackState.isPlaying ? (
              <Pause size={24} color={Colors.light.background} fill={Colors.light.background} />
            ) : (
              <Play size={24} color={Colors.light.background} fill={Colors.light.background} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => skipForward(30)}
            style={styles.controlButton}
            testID="skip-forward"
          >
            <SkipForward size={20} color={Colors.light.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            testID="close-player"
          >
            <X size={18} color={Colors.light.placeholder} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  progressBar: {
    height: 2,
    backgroundColor: Colors.light.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  episodeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.light.placeholder,
  },
  placeholderArtwork: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.light.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  podcast: {
    fontSize: 12,
    color: Colors.light.placeholder,
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: Colors.light.placeholder,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    backgroundColor: Colors.light.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 4,
  },
  loadingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.background,
    borderTopColor: 'transparent',
  },
});

export default MiniPlayer;