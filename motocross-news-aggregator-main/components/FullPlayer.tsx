import { Image } from 'expo-image';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  ChevronDown, 
  MoreHorizontal,
  Volume2
} from 'lucide-react-native';
import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Modal,
  SafeAreaView,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated
} from 'react-native';

import { usePodcastPlayer } from '@/hooks/use-podcast-player';
import Colors from '@/constants/colors';

// Web-compatible slider component
const WebCompatibleSlider: React.FC<{
  style: any;
  minimumValue: number;
  maximumValue: number;
  value: number;
  onSlidingComplete: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  disabled: boolean;
}> = ({ 
  style, 
  minimumValue, 
  maximumValue, 
  value, 
  onSlidingComplete, 
  minimumTrackTintColor, 
  maximumTrackTintColor, 
  thumbTintColor, 
  disabled 
}) => {
  const animatedValue = React.useRef(new Animated.Value(value)).current;
  const [isDragging, setIsDragging] = React.useState(false);
  const [sliderWidth, setSliderWidth] = React.useState(0);
  
  React.useEffect(() => {
    if (!isDragging) {
      animatedValue.setValue(value);
    }
  }, [value, isDragging, animatedValue]);
  
  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => {
      setIsDragging(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (sliderWidth > 0) {
        const newValue = Math.max(0, Math.min(1, gestureState.moveX / sliderWidth));
        animatedValue.setValue(newValue);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsDragging(false);
      if (sliderWidth > 0) {
        const newValue = Math.max(0, Math.min(1, gestureState.moveX / sliderWidth));
        onSlidingComplete(newValue);
      }
    },
  }), [disabled, sliderWidth, animatedValue, onSlidingComplete]);
  
  const progressWidth = React.useMemo(() => animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  }), [animatedValue]);
  
  return (
    <View 
      style={[style, { height: 40, justifyContent: 'center' }]}
      onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={{
        height: 4,
        backgroundColor: maximumTrackTintColor,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <Animated.View style={{
          height: '100%',
          width: progressWidth,
          backgroundColor: minimumTrackTintColor,
        }} />
      </View>
      <Animated.View style={{
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: thumbTintColor,
        left: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, sliderWidth - 10],
          extrapolate: 'clamp',
        }),
        top: 10,
        opacity: disabled ? 0.5 : 1,
      }} />
    </View>
  );
};

// Always use the web-compatible slider to avoid conditional hook usage
const Slider = WebCompatibleSlider;

const { width: screenWidth } = Dimensions.get('window');

interface FullPlayerProps {
  visible: boolean;
  onClose: () => void;
}

const FullPlayer: React.FC<FullPlayerProps> = ({ visible, onClose }) => {
  const { 
    playbackState, 
    togglePlayPause, 
    skipForward, 
    skipBackward, 
    formatTime, 
    controls,
    availablePlaybackRates 
  } = usePodcastPlayer();
  
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  if (!playbackState.currentEpisode) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <ChevronDown size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Now Playing</Text>
            <View style={styles.moreButton} />
          </View>
          <View style={styles.content}>
            <Text style={styles.noEpisodeText}>No episode selected</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // This component is only rendered when currentEpisode exists
  const currentEpisode = playbackState.currentEpisode;

  const progress = playbackState.duration > 0 ? playbackState.position / playbackState.duration : 0;

  const handleSeek = async (value: number) => {
    const position = value * playbackState.duration;
    await controls.seekTo(position);
  };

  const handleSpeedChange = async (rate: number) => {
    await controls.setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ChevronDown size={24} color={Colors.light.text} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Now Playing</Text>
          
          <TouchableOpacity 
            onPress={() => setShowSpeedMenu(true)} 
            style={styles.moreButton}
          >
            <MoreHorizontal size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.artworkContainer}>
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
          </View>

          <View style={styles.episodeInfo}>
            <Text style={styles.title} numberOfLines={3}>
              {currentEpisode.title}
            </Text>
            <Text style={styles.podcast}>
              {currentEpisode.source.name}
            </Text>
            {currentEpisode.description && (
              <Text style={styles.description} numberOfLines={4}>
                {currentEpisode.description}
              </Text>
            )}
          </View>

          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={progress}
              onSlidingComplete={handleSeek}
              minimumTrackTintColor={Colors.light.primary}
              maximumTrackTintColor={Colors.light.border}
              thumbTintColor={Colors.light.primary}
              disabled={playbackState.duration === 0}
            />
            
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(playbackState.position)}
              </Text>
              <Text style={styles.timeText}>
                {formatTime(playbackState.duration)}
              </Text>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              onPress={() => skipBackward(15)}
              style={styles.controlButton}
            >
              <SkipBack size={32} color={Colors.light.text} />
              <Text style={styles.skipText}>15s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlayPause}
              style={[styles.controlButton, styles.playButton]}
              disabled={playbackState.isLoading}
            >
              {playbackState.isLoading ? (
                <View style={styles.loadingIndicator} />
              ) : playbackState.isPlaying ? (
                <Pause size={48} color={Colors.light.background} fill={Colors.light.background} />
              ) : (
                <Play size={48} color={Colors.light.background} fill={Colors.light.background} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => skipForward(30)}
              style={styles.controlButton}
            >
              <SkipForward size={32} color={Colors.light.text} />
              <Text style={styles.skipText}>30s</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.speedContainer}>
            <Volume2 size={20} color={Colors.light.placeholder} />
            <Text style={styles.speedText}>
              Speed: {playbackState.playbackRate}x
            </Text>
          </View>
        </ScrollView>

        {/* Speed Selection Modal */}
        <Modal
          visible={showSpeedMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSpeedMenu(false)}
        >
          <TouchableOpacity 
            style={styles.speedModalOverlay}
            onPress={() => setShowSpeedMenu(false)}
          >
            <View style={styles.speedModal}>
              <Text style={styles.speedModalTitle}>Playback Speed</Text>
              {availablePlaybackRates.map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.speedOption,
                    playbackState.playbackRate === rate && styles.speedOptionSelected
                  ]}
                  onPress={() => handleSpeedChange(rate)}
                >
                  <Text style={[
                    styles.speedOptionText,
                    playbackState.playbackRate === rate && styles.speedOptionTextSelected
                  ]}>
                    {rate}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  moreButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  artwork: {
    width: screenWidth - 80,
    height: screenWidth - 80,
    borderRadius: 16,
    backgroundColor: Colors.light.placeholder,
  },
  placeholderArtwork: {
    width: screenWidth - 80,
    height: screenWidth - 80,
    borderRadius: 16,
    backgroundColor: Colors.light.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  episodeInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  podcast: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 20,
  },
  progressContainer: {
    marginBottom: 32,
  },
  slider: {
    width: '100%',
    height: 40,
  },

  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.light.placeholder,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 32,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  playButton: {
    backgroundColor: Colors.light.primary,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  skipText: {
    fontSize: 12,
    color: Colors.light.placeholder,
    marginTop: 4,
  },
  speedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  speedText: {
    fontSize: 14,
    color: Colors.light.placeholder,
  },
  loadingIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.light.background,
    borderTopColor: 'transparent',
  },
  speedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedModal: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16,
    padding: 24,
    minWidth: 200,
    maxWidth: 280,
  },
  speedModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  speedOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  speedOptionSelected: {
    backgroundColor: Colors.light.primary,
  },
  speedOptionText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: 'center',
  },
  speedOptionTextSelected: {
    color: Colors.light.background,
    fontWeight: '600',
  },
  noEpisodeText: {
    fontSize: 16,
    color: Colors.light.placeholder,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default FullPlayer;