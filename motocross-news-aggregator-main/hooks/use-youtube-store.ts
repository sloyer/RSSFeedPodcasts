import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useState, useMemo } from "react";

import { YouTubeVideo } from "@/types/youtube";
import { fetchVideosByChannel } from "@/services/youtube-api";
import { useSubscription } from "@/hooks/use-subscription";
import { fetchYouTubeFeedSources, FeedSource } from "@/services/feed-sources-api";

// Define YouTubeChannel type for compatibility
interface YouTubeChannel extends FeedSource {
  channelId?: string;
}



const ENABLED_CHANNELS_STORAGE_KEY = "mx-youtube-enabled-channels";
const BOOKMARKS_STORAGE_KEY = "mx-youtube-bookmarks";
const VIDEOS_PER_PAGE = 10;
const TOTAL_VIDEOS_LIMIT = 50;

interface LoadingProgress {
  feedName: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  articlesCount?: number;
  error?: string;
}

export const [YouTubeProvider, useYouTubeStore] = createContextHook(() => {
  // All useState calls first - MUST be in the same order every render
  const [enabledChannels, setEnabledChannels] = useState<YouTubeChannel[]>(youtubeChannels);
  const [bookmarks, setBookmarks] = useState<YouTubeVideo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [allVideos, setAllVideos] = useState<YouTubeVideo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress[]>([]);
  
  // Get query client and subscription - MUST be called after all useState calls
  const queryClient = useQueryClient();
  const { getFeedLimits, canEnableMoreFeeds } = useSubscription();

  // Load data from storage
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [storedEnabledChannels, storedBookmarks] = await Promise.all([
          AsyncStorage.getItem(ENABLED_CHANNELS_STORAGE_KEY),
          AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY)
        ]);
        
        if (storedEnabledChannels) {
          const storedChannels = JSON.parse(storedEnabledChannels);
          console.log('📱 Loaded stored channels:', storedChannels.map((c: YouTubeChannel) => `${c.id}:${c.enabled}`).join(', '));
          
          // Merge with current channels to handle new channels being added
          const mergedChannels = youtubeChannels.map(channel => {
            const stored = storedChannels.find((c: YouTubeChannel) => c.id === channel.id);
            return stored ? { ...channel, enabled: stored.enabled } : channel;
          });
          
          // Check if we have any enabled channels, if not, reset to defaults
          const enabledCount = mergedChannels.filter(c => c.enabled).length;
          if (enabledCount === 0) {
            console.log('⚠️ No enabled channels found, resetting to defaults');
            setEnabledChannels(youtubeChannels); // Use defaults
            // Clear the stored preferences to force reset
            await AsyncStorage.removeItem(ENABLED_CHANNELS_STORAGE_KEY);
          } else {
            // For existing users, ensure they have the free default channels enabled if they don't have any enabled
            const freeDefaultChannels = ['mxvice', 'dirtbike', 'supercross'];
            const hasAnyFreeDefaults = mergedChannels.some(c => freeDefaultChannels.includes(c.id) && c.enabled);
            
            if (!hasAnyFreeDefaults && enabledCount === 0) {
              // Enable the free default channels for existing users with no enabled channels
              const updatedChannels = mergedChannels.map(channel => ({
                ...channel,
                enabled: freeDefaultChannels.includes(channel.id)
              }));
              setEnabledChannels(updatedChannels);
              console.log('✅ Enabled default free YouTube channels for existing user');
            } else {
              setEnabledChannels(mergedChannels);
            }
          }
        } else {
          console.log('📱 No stored channels found, using defaults');
          setEnabledChannels(youtubeChannels);
        }
        
        if (storedBookmarks) {
          setBookmarks(JSON.parse(storedBookmarks));
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to load stored data:", error);
        // On error, use defaults
        setEnabledChannels(youtubeChannels);
        setIsInitialized(true);
      }
    };

    loadStoredData();
  }, []);

  // Save enabled channels to storage whenever they change
  useEffect(() => {
    if (!isInitialized) return;

    const saveEnabledChannels = async () => {
      try {
        await AsyncStorage.setItem(ENABLED_CHANNELS_STORAGE_KEY, JSON.stringify(enabledChannels));
      } catch (error) {
        console.error("Failed to save enabled channels:", error);
      }
    };

    saveEnabledChannels();
  }, [enabledChannels, isInitialized]);

  // Save bookmarks to storage whenever they change
  useEffect(() => {
    if (!isInitialized) return;

    const saveBookmarks = async () => {
      try {
        await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
      } catch (error) {
        console.error("Failed to save bookmarks:", error);
      }
    };

    saveBookmarks();
  }, [bookmarks, isInitialized]);

  const fetchVideos = async (): Promise<YouTubeVideo[]> => {
    const startTime = Date.now();
    console.log('🎥 Fetching videos from', enabledChannels.filter(c => c.enabled).length, 'channel(s)...');
    
    const feedLimits = getFeedLimits();
    const maxChannels = feedLimits.youtube === -1 ? enabledChannels.length : feedLimits.youtube;
    const activeChannels = enabledChannels
      .filter(channel => channel.enabled)
      .slice(0, maxChannels); // Respect subscription limits
    
    if (activeChannels.length === 0) {
      console.log('⚠️ No active YouTube channels enabled');
      setErrorMessage('No YouTube channels are enabled. Please enable some channels in Settings.');
      return [];
    }

    try {
      setErrorMessage(undefined);
      
      // Initialize progress tracking
      const progressItems: LoadingProgress[] = activeChannels.map(channel => ({
        feedName: channel.name,
        status: 'pending' as const,
        articlesCount: 0
      }));
      setLoadingProgress(progressItems);
      
      const videosPerChannel = Math.ceil(TOTAL_VIDEOS_LIMIT / activeChannels.length);
      
      // Fetch videos from all channels in parallel for much faster loading
      const channelPromises = activeChannels.map(async (channel, index) => {
        // Update progress to loading
        setLoadingProgress(prev => prev.map((item, i) => 
          i === index ? { ...item, status: 'loading' as const } : item
        ));
        
        try {
          console.log(`🔄 Fetching data for ${channel.name}`);
          console.log(`📡 API Code: ${channel.apiCode}`);
          
          const channelVideos = await fetchVideosByChannel(
            channel.apiCode,
            videosPerChannel,
            0
          );
          
          if (channelVideos.length === 0) {
            console.log(`⚠️ No videos found for ${channel.name}, skipping...`);
            // Update status to completed with 0 videos
            setLoadingProgress(prev => prev.map((item, i) => 
              i === index ? { ...item, status: 'completed' as const, articlesCount: 0 } : item
            ));
            return [];
          }
          
          console.log(`📱 Added ${channelVideos.length} videos from ${channel.name}`);
          
          // Update progress to completed
          setLoadingProgress(prev => prev.map((item, i) => 
            i === index ? { ...item, status: 'completed' as const, articlesCount: channelVideos.length } : item
          ));
          
          return channelVideos;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Error fetching videos from ${channel.name}:`, errorMsg);
          
          // Update progress to error
          setLoadingProgress(prev => prev.map((item, i) => 
            i === index ? { ...item, status: 'error' as const, error: errorMsg } : item
          ));
          return [];
        }
      });
      
      // Wait for all channels to complete (parallel execution)
      const channelResults = await Promise.all(channelPromises);
      const allVideos = channelResults.flat();
      
      if (allVideos.length === 0) {
        setErrorMessage(`No videos could be fetched from any enabled channels. Please check your internet connection and try again later.`);
        return [];
      }
      
      // Sort videos by publish date (newest first)
      const sortedVideos = allVideos.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      
      // Limit to total videos limit
      const limitedVideos = sortedVideos.slice(0, TOTAL_VIDEOS_LIMIT);
      
      // Mark videos as bookmarked if they exist in bookmarks
      const videosWithBookmarks = limitedVideos.map(video => ({
        ...video,
        isBookmarked: bookmarks.some(b => b.id === video.id)
      }));
      
      const totalTime = Date.now() - startTime;
      console.log(`📊 Returning ${videosWithBookmarks.length} total videos`);
      console.log(`⏱️ Total fetch time: ${totalTime}ms`);
      
      return videosWithBookmarks;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const totalTime = Date.now() - startTime;
      console.error(`❌ Critical error after ${totalTime}ms:`, errorMsg);
      
      setErrorMessage(`Failed to fetch videos: ${errorMsg}. Please check your internet connection and try again.`);
      
      // Return empty array to prevent app crash
      return [];
    }
  };

  const { data: fetchedVideos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['youtube-videos', enabledChannels.map(c => c.apiCode + c.enabled).join(''), TOTAL_VIDEOS_LIMIT],
    queryFn: fetchVideos,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 5000,
    enabled: isInitialized, // Only run query after initialization
  });

  // Update allVideos and reset pagination when new data is fetched
  useEffect(() => {
    if (fetchedVideos.length > 0) {
      // Update bookmark status for all videos
      const videosWithUpdatedBookmarks = fetchedVideos.map(video => ({
        ...video,
        isBookmarked: bookmarks.some(b => b.id === video.id)
      }));
      setAllVideos(videosWithUpdatedBookmarks);
      setCurrentPage(1); // Reset to first page when new data arrives
    }
  }, [fetchedVideos, bookmarks]);

  // Calculate displayed videos based on current page
  const videos = allVideos.slice(0, currentPage * VIDEOS_PER_PAGE);
  const hasMore = videos.length < allVideos.length;

  const refreshVideos = useCallback(async () => {
    console.log('🔄 Refreshing YouTube videos via API...');
    setErrorMessage(undefined);
    setCurrentPage(1); // Reset pagination on refresh
    await refetch();
  }, [refetch]);

  const loadMoreVideos = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      console.log(`📄 Loading more videos... Current page: ${currentPage}, Total videos: ${allVideos.length}`);
      setIsLoadingMore(true);
      
      // Simulate loading delay for better UX
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, isLoadingMore, currentPage, allVideos.length]);

  const toggleChannelEnabled = useCallback((channelId: string) => {
    console.log(`🔄 Toggling channel: ${channelId}`);
    setEnabledChannels(prev => {
      const channel = prev.find(c => c.id === channelId);
      if (!channel) return prev;
      
      // If trying to enable a channel, check subscription limits
      if (!channel.enabled) {
        const currentEnabledCount = prev.filter(c => c.enabled).length;
        if (!canEnableMoreFeeds('youtube', currentEnabledCount)) {
          console.log('Cannot enable more channels - subscription limit reached');
          return prev; // Don't allow enabling if limit reached
        }
      }
      
      return prev.map(c => {
        if (c.id === channelId) {
          const newState = !c.enabled;
          console.log(`${c.name} is now ${newState ? 'enabled' : 'disabled'}`);
          return { ...c, enabled: newState };
        }
        return c;
      });
    });
  }, [canEnableMoreFeeds]);

  const toggleBookmark = useCallback((videoId: string) => {
    const video = allVideos.find(v => v.id === videoId);
    
    if (!video) return;
    
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.id === videoId);
      
      if (isBookmarked) {
        return prev.filter(b => b.id !== videoId);
      } else {
        return [...prev, { ...video, isBookmarked: true }];
      }
    });
    
    setAllVideos(prev => prev.map(v => {
      if (v.id === videoId) {
        return { ...v, isBookmarked: !v.isBookmarked };
      }
      return v;
    }));
    
    queryClient.setQueryData(['youtube-videos', enabledChannels.map(c => c.apiCode + c.enabled).join(''), TOTAL_VIDEOS_LIMIT], (oldData: YouTubeVideo[] | undefined) => {
      if (!oldData) return allVideos;
      
      return oldData.map(v => {
        if (v.id === videoId) {
          return { ...v, isBookmarked: !v.isBookmarked };
        }
        return v;
      });
    });
  }, [allVideos, queryClient, enabledChannels]);

  // Debug function to reset all channels to defaults
  const resetChannelsToDefaults = useCallback(async () => {
    console.log('🔄 Resetting YouTube channels to defaults...');
    try {
      await AsyncStorage.removeItem(ENABLED_CHANNELS_STORAGE_KEY);
      setEnabledChannels(youtubeChannels);
      console.log('✅ Reset complete, all channels enabled by default');
      // Force refetch with new channels
      await refetch();
    } catch (error) {
      console.error('❌ Failed to reset channels:', error);
    }
  }, [refetch]);

  return useMemo(() => ({
    videos,
    allVideos,
    bookmarks,
    isLoading: isLoading || !isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    errorMessage,
    enabledChannels,
    loadingProgress,
    refreshVideos,
    loadMoreVideos,
    toggleChannelEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
    resetChannelsToDefaults,
  }), [
    videos,
    allVideos,
    bookmarks,
    isLoading,
    isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    errorMessage,
    enabledChannels,
    loadingProgress,
    refreshVideos,
    loadMoreVideos,
    toggleChannelEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
    resetChannelsToDefaults,
  ]);
});