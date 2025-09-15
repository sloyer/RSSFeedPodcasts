import { Audio } from 'expo-av';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import { PodcastEpisode, PlaybackState, PlayerControls } from '@/types/podcast';

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const PLAYBACK_POSITION_KEY = 'podcast_playback_positions';
const LISTENED_EPISODES_KEY = 'podcast_listened_episodes';

interface SavedPlaybackPosition {
  episodeId: string;
  position: number;
  duration: number;
  lastPlayed: number;
}



interface ListenedEpisode {
  episodeId: string;
  completedAt: number;
  duration: number;
}

export const [PodcastPlayerProvider, usePodcastPlayer] = createContextHook(() => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);
  const [isSettingPosition, setIsSettingPosition] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isLoading: false,
    position: 0,
    duration: 0,
    currentEpisode: null,
    playbackRate: 1.0,
    isBuffering: false,
  });

  const markEpisodeAsListened = useCallback(async (episode: PodcastEpisode, duration: number) => {
    try {
      const episodeId = `${episode.source.name}-${episode.title}`;
      const listenedData = await AsyncStorage.getItem(LISTENED_EPISODES_KEY);
      const listenedEpisodes: Record<string, ListenedEpisode> = listenedData ? JSON.parse(listenedData) : {};
      
      listenedEpisodes[episodeId] = {
        episodeId,
        completedAt: Date.now(),
        duration,
      };
      
      await AsyncStorage.setItem(LISTENED_EPISODES_KEY, JSON.stringify(listenedEpisodes));
      console.log('Marked episode as listened:', episode.title);
    } catch (error) {
      console.error('Failed to mark episode as listened:', error);
    }
  }, []);

  const savePlaybackPosition = useCallback(async (episode: PodcastEpisode, position: number, duration: number) => {
    try {
      const episodeId = `${episode.source.name}-${episode.title}`;
      const positionsData = await AsyncStorage.getItem(PLAYBACK_POSITION_KEY);
      const positions: Record<string, SavedPlaybackPosition> = positionsData ? JSON.parse(positionsData) : {};
      
      positions[episodeId] = {
        episodeId,
        position,
        duration,
        lastPlayed: Date.now(),
      };
      
      await AsyncStorage.setItem(PLAYBACK_POSITION_KEY, JSON.stringify(positions));
      
      // Check if episode should be marked as listened (95% or more completed)
      const progressPercent = position / duration;
      if (progressPercent >= 0.95) {
        await markEpisodeAsListened(episode, duration);
      }
      

    } catch (error) {
      console.error('Failed to save playback position:', error);
    }
  }, [markEpisodeAsListened]);

  // Initialize audio mode
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        if (Platform.OS !== 'web') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        }
      } catch (error) {
        console.error('Failed to initialize audio mode:', error);
      }
    };

    initializeAudio();
  }, []);

  // Save playback position periodically and on position changes
  useEffect(() => {
    const savePosition = async () => {
      if (playbackState.currentEpisode && playbackState.position > 0 && playbackState.duration > 0) {
        await savePlaybackPosition(
          playbackState.currentEpisode,
          playbackState.position,
          playbackState.duration
        );
      }
    };

    const interval = setInterval(savePosition, 2000); // Save every 2 seconds
    return () => clearInterval(interval);
  }, [playbackState.currentEpisode, playbackState.position, playbackState.duration, savePlaybackPosition]);

  // Save position immediately when position changes significantly (every 10 seconds of playback)
  useEffect(() => {
    const savePositionImmediate = async () => {
      if (playbackState.currentEpisode && playbackState.position > 0 && playbackState.duration > 0) {
        // Only save if position changed by more than 10 seconds since last save
        const positionSeconds = Math.floor(playbackState.position / 1000);
        if (positionSeconds % 10 === 0) {
          await savePlaybackPosition(
            playbackState.currentEpisode,
            playbackState.position,
            playbackState.duration
          );
        }
      }
    };

    savePositionImmediate();
  }, [playbackState.position, playbackState.currentEpisode, playbackState.duration, savePlaybackPosition]);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);





  const updatePlaybackStatus = useCallback((status: any) => {
    if (status.isLoaded) {
      setIsSoundLoaded(true);
      setPlaybackState(prev => {
        const newPosition = status.positionMillis || 0;
        
        // If we're setting position, don't update from status until we're done
        // Otherwise, update position normally
        const shouldUpdatePosition = !isSettingPosition;
        
        return {
          ...prev,
          isPlaying: status.isPlaying || false,
          position: shouldUpdatePosition ? newPosition : prev.position,
          duration: status.durationMillis || 0,
          isBuffering: status.isBuffering || false,
          isLoading: false,
        };
      });
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setIsSoundLoaded(false);
      setPlaybackState(prev => ({
        ...prev,
        isLoading: false,
        isPlaying: false,
      }));
    }
  }, [isSettingPosition]);



  const loadPlaybackPosition = useCallback(async (episode: PodcastEpisode): Promise<number> => {
    try {
      const episodeId = `${episode.source.name}-${episode.title}`;
      const positionsData = await AsyncStorage.getItem(PLAYBACK_POSITION_KEY);
      if (positionsData) {
        const positions: Record<string, SavedPlaybackPosition> = JSON.parse(positionsData);
        const savedPosition = positions[episodeId];
        if (savedPosition && savedPosition.position > 0) {
          // Don't restore if more than 95% complete
          const progressPercent = savedPosition.position / savedPosition.duration;
          if (progressPercent < 0.95) {
            console.log('Restoring playback position:', savedPosition.position, 'for episode:', episode.title);
            return savedPosition.position;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load playback position:', error);
    }
    return 0;
  }, []);

  const loadEpisode = useCallback(async (episode: PodcastEpisode, autoPlay: boolean = false) => {
    try {
      console.log('Loading episode:', episode.title, 'Audio URL:', episode.audioUrl, 'AutoPlay:', autoPlay);
      
      if (!episode.audioUrl) {
        console.error('No audio URL provided for episode:', episode.title);
        return;
      }

      // Load saved playback position first
      const savedPosition = await loadPlaybackPosition(episode);
      console.log('Saved position for episode:', episode.title, savedPosition);

      // Set loading state immediately
      setPlaybackState(prev => ({
        ...prev,
        isLoading: true,
        currentEpisode: episode,
        position: savedPosition, // Set to saved position immediately
      }));

      // Unload previous sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsSoundLoaded(false);
      }

      // Lock position updates immediately if we have a saved position
      if (savedPosition > 0) {
        setIsSettingPosition(true);
      }

      // Create new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: episode.audioUrl },
        {
          shouldPlay: false,
          rate: playbackState.playbackRate,
          shouldCorrectPitch: true,
          positionMillis: savedPosition, // Set initial position here
        },
        updatePlaybackStatus
      );

      setSound(newSound);
      
      // Wait for the sound to be fully loaded
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts) {
        const status = await newSound.getStatusAsync();
        if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
          console.log('Sound is loaded. Duration:', status.durationMillis, 'Current position:', status.positionMillis);

          // Set position if we have a saved position
          if (savedPosition > 0) {
            try {
              console.log('Setting position to saved position:', savedPosition);
              
              // Set position once and wait for it to take effect
              await newSound.setPositionAsync(savedPosition);
              
              // Wait a moment for the position to be set
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Get the actual position after setting
              const finalStatus = await newSound.getStatusAsync();
              const actualPosition = finalStatus.isLoaded ? (finalStatus.positionMillis || 0) : 0;
              
              console.log('Position set. Target:', savedPosition, 'Actual:', actualPosition);
              
              // Update state with the actual position
              setPlaybackState(prev => ({
                ...prev,
                position: actualPosition,
                duration: status.durationMillis || 0,
                isLoading: false,
              }));
              
              // Unlock position updates after a delay
              setTimeout(() => {
                console.log('Unlocking position updates');
                setIsSettingPosition(false);
              }, 2000);
              
            } catch (positionError) {
              console.error('Failed to set position:', positionError);
              setIsSettingPosition(false);
              // Update state with duration but position 0
              setPlaybackState(prev => ({
                ...prev,
                position: 0,
                duration: status.durationMillis || 0,
                isLoading: false,
              }));
            }
          } else {
            // No saved position, just update with duration
            setPlaybackState(prev => ({
              ...prev,
              position: 0,
              duration: status.durationMillis || 0,
              isLoading: false,
            }));
            setIsSettingPosition(false);
          }

          // Start playback if requested
          if (autoPlay) {
            console.log('Starting playback', savedPosition > 0 ? `from saved position: ${savedPosition}ms` : 'from beginning');
            await newSound.playAsync();
          }

          console.log('Episode loaded successfully:', episode.title, savedPosition > 0 ? `at position ${savedPosition}ms` : '', autoPlay ? '(auto-playing)' : '');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      throw new Error('Sound failed to load within timeout period');
      
    } catch (error) {
      console.error('Failed to load episode:', error);
      setIsSoundLoaded(false);
      setIsSettingPosition(false);
      setPlaybackState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [sound, playbackState.playbackRate, updatePlaybackStatus, loadPlaybackPosition]);

  const play = useCallback(async () => {
    try {
      if (sound && isSoundLoaded) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.playAsync();
        } else {
          console.warn('Cannot play: sound is not loaded');
        }
      } else {
        console.warn('Cannot play: sound is null or not loaded');
      }
    } catch (error) {
      console.error('Failed to play:', error);
    }
  }, [sound, isSoundLoaded]);

  const pause = useCallback(async () => {
    try {
      if (sound && isSoundLoaded) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.pauseAsync();
        }
      }
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  }, [sound, isSoundLoaded]);

  const stop = useCallback(async () => {
    try {
      if (sound && isSoundLoaded && playbackState.currentEpisode) {
        // Save current position before stopping
        await savePlaybackPosition(
          playbackState.currentEpisode,
          playbackState.position,
          playbackState.duration
        );
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.setPositionAsync(0);
        }
      }
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }, [sound, isSoundLoaded, playbackState.currentEpisode, playbackState.position, playbackState.duration, savePlaybackPosition]);

  const clearCurrentEpisode = useCallback(async () => {
    try {
      // Save current position before clearing if we have a current episode
      if (sound && playbackState.currentEpisode && playbackState.position > 0) {
        await savePlaybackPosition(
          playbackState.currentEpisode,
          playbackState.position,
          playbackState.duration
        );
      }
      
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
        }
        await sound.unloadAsync();
        setSound(null);
        setIsSoundLoaded(false);
      }
      
      // Clear the current episode from state but keep saved positions
      setPlaybackState(prev => ({
        ...prev,
        currentEpisode: null,
        isPlaying: false,
        position: 0,
        duration: 0,
        isLoading: false,
        isBuffering: false,
      }));
      
      // Don't remove from AsyncStorage - keep the saved position for later
      console.log('Cleared current episode from player (position saved)');
    } catch (error) {
      console.error('Failed to clear current episode:', error);
    }
  }, [sound, playbackState.currentEpisode, playbackState.position, playbackState.duration, savePlaybackPosition]);

  const seekTo = useCallback(async (position: number) => {
    try {
      if (sound && isSoundLoaded) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(position);
        }
      }
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, [sound, isSoundLoaded]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    try {
      if (sound && isSoundLoaded) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setRateAsync(rate, true);
          setPlaybackState(prev => ({
            ...prev,
            playbackRate: rate,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  }, [sound, isSoundLoaded]);

  const skipForward = useCallback(async (seconds: number = 30) => {
    try {
      if (sound && isSoundLoaded && playbackState.duration > 0) {
        const newPosition = Math.min(
          playbackState.position + (seconds * 1000),
          playbackState.duration
        );
        await seekTo(newPosition);
      }
    } catch (error) {
      console.error('Failed to skip forward:', error);
    }
  }, [sound, isSoundLoaded, playbackState.position, playbackState.duration, seekTo]);

  const skipBackward = useCallback(async (seconds: number = 15) => {
    try {
      if (sound && isSoundLoaded) {
        const newPosition = Math.max(
          playbackState.position - (seconds * 1000),
          0
        );
        await seekTo(newPosition);
      }
    } catch (error) {
      console.error('Failed to skip backward:', error);
    }
  }, [sound, isSoundLoaded, playbackState.position, seekTo]);

  const togglePlayPause = useCallback(async () => {
    if (playbackState.isPlaying) {
      await pause();
    } else {
      // If no sound is loaded but we have a current episode, load it first
      if ((!sound || !isSoundLoaded) && playbackState.currentEpisode) {
        console.log('No sound loaded, loading episode with saved position and auto-playing');
        await loadEpisode(playbackState.currentEpisode, true);
      } else {
        await play();
      }
    }
  }, [playbackState.isPlaying, playbackState.currentEpisode, sound, isSoundLoaded, play, pause, loadEpisode]);



  const isEpisodeListened = useCallback(async (episode: PodcastEpisode): Promise<boolean> => {
    try {
      const episodeId = `${episode.source.name}-${episode.title}`;
      const listenedData = await AsyncStorage.getItem(LISTENED_EPISODES_KEY);
      if (listenedData) {
        const listenedEpisodes: Record<string, ListenedEpisode> = JSON.parse(listenedData);
        return !!listenedEpisodes[episodeId];
      }
    } catch (error) {
      console.error('Failed to check if episode is listened:', error);
    }
    return false;
  }, []);

  const getEpisodeProgress = useCallback(async (episode: PodcastEpisode): Promise<{ position: number; duration: number; progressPercent: number } | null> => {
    try {
      const episodeId = `${episode.source.name}-${episode.title}`;
      const positionsData = await AsyncStorage.getItem(PLAYBACK_POSITION_KEY);
      if (positionsData) {
        const positions: Record<string, SavedPlaybackPosition> = JSON.parse(positionsData);
        const savedPosition = positions[episodeId];
        if (savedPosition && savedPosition.position > 5000) { // More than 5 seconds
          const progressPercent = savedPosition.position / savedPosition.duration;
          return {
            position: savedPosition.position,
            duration: savedPosition.duration,
            progressPercent,
          };
        }
      }
    } catch (error) {
      console.error('Failed to get episode progress:', error);
    }
    return null;
  }, []);

  const getAllEpisodesWithProgress = useCallback(async (): Promise<(SavedPlaybackPosition & { episodeData?: PodcastEpisode })[]> => {
    try {
      const positionsData = await AsyncStorage.getItem(PLAYBACK_POSITION_KEY);
      if (positionsData) {
        const positions: Record<string, SavedPlaybackPosition> = JSON.parse(positionsData);
        
        // Filter and sort episodes with meaningful progress
        const episodesWithProgress = Object.values(positions)
          .filter(pos => {
            const progressPercent = pos.position / pos.duration;
            return pos.position > 0 && progressPercent < 0.95; // Any progress and less than 95% complete
          })
          .sort((a, b) => b.lastPlayed - a.lastPlayed); // Sort by most recently played
        
        return episodesWithProgress;
      }
    } catch (error) {
      console.error('Failed to get all episodes with progress:', error);
    }
    return [];
  }, []);

  const formatTime = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const loadAndPlay = useCallback(async (episode: PodcastEpisode) => {
    await loadEpisode(episode, true);
  }, [loadEpisode]);

  const continueFromSavedPosition = useCallback(async (episode: PodcastEpisode) => {
    try {
      console.log('Continue from saved position for:', episode.title);
      
      // The loadEpisode function already handles saved positions properly
      // Just call it with autoPlay=true and it will restore the position and start playing
      await loadEpisode(episode, true);
      
    } catch (error) {
      console.error('Failed to continue from saved position:', error);
      // Fallback to normal load and play
      await loadEpisode(episode, true);
    }
  }, [loadEpisode]);

  const controls: PlayerControls = {
    play,
    pause,
    stop,
    seekTo,
    setPlaybackRate,
    loadEpisode,
    loadAndPlay,
    clearCurrentEpisode,
  };

  return {
    playbackState,
    controls,
    skipForward,
    skipBackward,
    togglePlayPause,
    formatTime,
    availablePlaybackRates: PLAYBACK_RATES,
    savePlaybackPosition,
    markEpisodeAsListened,
    isEpisodeListened,
    getEpisodeProgress,
    getAllEpisodesWithProgress,
    continueFromSavedPosition,
  };
});

export type PodcastPlayerContextType = ReturnType<typeof usePodcastPlayer>;