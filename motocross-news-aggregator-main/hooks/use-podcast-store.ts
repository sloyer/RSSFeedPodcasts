import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useState, useMemo } from "react";


import { PodcastEpisode } from "@/types/podcast";
import { useSubscription } from "@/hooks/use-subscription";
import { fetchPodcastFeedSources, FeedSource } from "@/services/feed-sources-api";

// Define PodcastSource type for compatibility
interface PodcastSource extends FeedSource {
  url: string;
}



const ENABLED_PODCASTS_STORAGE_KEY = "mx-news-enabled-podcasts";
const BOOKMARKS_STORAGE_KEY = "mx-podcast-bookmarks";
const EPISODES_PER_PAGE = 10;

interface LoadingProgress {
  feedName: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  articlesCount?: number;
  error?: string;
}

export const [PodcastProvider, usePodcastStore] = createContextHook(() => {
  // All hooks MUST be called in the same order every render
  const [enabledPodcasts, setEnabledPodcasts] = useState<PodcastSource[]>([]);
  const [availablePodcasts, setAvailablePodcasts] = useState<PodcastSource[]>([]);
  const [bookmarks, setBookmarks] = useState<PodcastEpisode[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState<PodcastEpisode[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress[]>([]);
  
  // All other hooks must be called unconditionally
  const queryClient = useQueryClient();
  const { getFeedLimits, canEnableMoreFeeds } = useSubscription();

  const fetchAllEpisodes = useCallback(async (): Promise<PodcastEpisode[]> => {
    if (!isInitialized) {
      console.log('🚫 Not initialized yet, returning empty array');
      return [];
    }

    const feedLimits = getFeedLimits();
    const maxPodcasts = feedLimits.podcasts === -1 ? enabledPodcasts.length : feedLimits.podcasts;
    const activePodcasts = enabledPodcasts
      .filter(podcast => podcast.enabled)
      .slice(0, maxPodcasts);
    
    if (activePodcasts.length === 0) {
      console.log('⚠️ No active podcasts enabled');
      setLoadingProgress([]);
      return [];
    }

    console.log(`🎙️ Fetching episodes from ${activePodcasts.length} podcast(s)...`);
    
    // Initialize loading progress
    const initialProgress: LoadingProgress[] = activePodcasts.map(podcast => ({
      feedName: podcast.name,
      status: 'pending' as const
    }));
    setLoadingProgress(initialProgress);
    
    // Fetch all podcasts in parallel using the API
    const podcastPromises = activePodcasts.map(async (podcast, index) => {
      // Update status to loading
      setLoadingProgress(prev => prev.map((item, i) => 
        i === index ? { ...item, status: 'loading' as const } : item
      ));
      
      try {
        console.log(`🔄 Fetching data for ${podcast.name}`);
        
        // Use the specific podcast URL from the constants
        const apiUrl = podcast.url;
        console.log(`📡 API URL for ${podcast.name} (ID: ${podcast.id}): ${apiUrl}`);
        
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; MXNewsApp/1.0)',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`📊 API Response for ${podcast.name} (ID: ${podcast.id}):`, { 
          success: data?.success,
          dataLength: data?.data?.length || 'N/A',
          error: data?.error || 'None',
          firstItemId: data?.data?.[0]?.id || 'N/A',
          firstItemTitle: data?.data?.[0]?.podcast_title || data?.data?.[0]?.title || 'N/A',
          firstItemShowName: data?.data?.[0]?.show_name || 'N/A',
          firstItemPodcastShow: data?.data?.[0]?.podcast_show || 'N/A',
          firstItemFeedTitle: data?.data?.[0]?.feed_title || 'N/A',
          availableFields: data?.data?.[0] ? Object.keys(data.data[0]).slice(0, 10) : 'N/A'
        });
        
        // Check for API errors first
        if (data?.error) {
          throw new Error(`API Error: ${data.error}`);
        }
        
        // Handle multiple possible API response formats
        let podcastEpisodes: any[] = [];
        
        if (data?.success && Array.isArray(data?.data)) {
          // Format: { success: true, data: [...] }
          podcastEpisodes = data.data;
        } else if (Array.isArray(data?.data)) {
          // Format: { data: [...] }
          podcastEpisodes = data.data;
        } else if (Array.isArray(data)) {
          // Format: [...]
          podcastEpisodes = data;
        } else if (data && typeof data === 'object') {
          // Try to find any array property in the response
          const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
          if (arrayKeys.length > 0) {
            console.log(`📊 Found array property '${arrayKeys[0]}' in response for ${podcast.name}`);
            podcastEpisodes = data[arrayKeys[0]];
          } else {
            console.warn(`⚠️ No array found in API response for ${podcast.name}:`, {
              dataType: typeof data,
              keys: Object.keys(data),
              hasSuccess: 'success' in data,
              hasData: 'data' in data
            });
            // Update status to completed with 0 episodes
            setLoadingProgress(prev => prev.map((item, i) => 
              i === index ? { ...item, status: 'completed' as const, articlesCount: 0 } : item
            ));
            return [];
          }
        } else {
          throw new Error('Invalid API response format');
        }
        
        console.log(`📊 Found ${podcastEpisodes.length} episodes for ${podcast.name}`);
        
        if (podcastEpisodes.length === 0) {
          console.log(`⚠️ No episodes found for ${podcast.name}, skipping...`);
          // Update status to completed with 0 episodes
          setLoadingProgress(prev => prev.map((item, i) => 
            i === index ? { ...item, status: 'completed' as const, articlesCount: 0 } : item
          ));
          return [];
        }
        
        // Limit to 10 most recent episodes per podcast
        const recentEpisodes = podcastEpisodes
          .sort((a: any, b: any) => new Date(b.podcast_date || b.published_date || b.created_at).getTime() - new Date(a.podcast_date || a.published_date || a.created_at).getTime())
          .slice(0, 10);
        
        // Convert data to podcast episodes with proper image handling
        const convertedEpisodes = recentEpisodes.map((item: any, episodeIndex: number) => {
          // Parse the podcast_image field which can be in different formats
          let imageUrl = podcast.logo || 'https://via.placeholder.com/300x300/FF5722/FFFFFF?text=Podcast';
          
          if (item.podcast_image || item.image_url) {
            try {
              let parsedImageUrl = '';
              const imageField = item.podcast_image || item.image_url;
              
              // Handle JSON array format: "[\"https://example.com/image.jpg\"]"
              if (typeof imageField === 'string' && imageField.startsWith('[')) {
                const parsed = JSON.parse(imageField);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  parsedImageUrl = parsed[0];
                }
              }
              // Handle object format: "{\"$\":{\"href\":\"https://example.com/image.jpg\"}}"
              else if (typeof imageField === 'string' && imageField.startsWith('{')) {
                const parsed = JSON.parse(imageField);
                if (parsed && parsed.$ && parsed.$.href) {
                  parsedImageUrl = parsed.$.href;
                }
              }
              // Handle direct URL string
              else if (typeof imageField === 'string' && imageField.startsWith('http')) {
                parsedImageUrl = imageField;
              }
              
              // Clean up the parsed URL - remove any extra quotes or brackets
              if (parsedImageUrl) {
                parsedImageUrl = parsedImageUrl.replace(/["'\[\]]/g, '').trim();
              }
              
              // Use the parsed image if it's valid
              if (parsedImageUrl && parsedImageUrl.startsWith('http') && !parsedImageUrl.includes('placeholder')) {
                imageUrl = parsedImageUrl;
                console.log(`✅ Using parsed image for ${podcast.name}:`, imageUrl);
              }
            } catch (parseError) {
              console.log(`⚠️ Failed to parse image for ${podcast.name}:`, parseError);
            }
          }
          
          const episodeId = `${podcast.id}-${item.id || item.guid || Date.now()}-${episodeIndex}`;
          // Use the actual show name from API data, fallback to constants name
          const actualShowName = item.show_name || item.podcast_show || item.feed_title || podcast.name;
          
          const episode: PodcastEpisode = {
            id: episodeId,
            title: item.podcast_title || item.title || 'Untitled Episode',
            description: item.podcast_description || item.description || item.summary || item.excerpt || '',
            publishDate: item.podcast_date || item.published_date || item.publishDate || item.pubDate || item.published || new Date().toISOString(),
            link: item.feed_url || item.article_url || item.link || item.url || '',
            duration: item.duration || item.itunes_duration || 'Unknown',
            audioUrl: item.audio_url || item.audioUrl || item.enclosure?.url || item.url || '',
            imageUrl: imageUrl,
            source: {
              id: podcast.id, // This should match the podcast ID from constants
              name: actualShowName, // Use actual show name from API
              logo: podcast.logo,
            },
            isBookmarked: bookmarks.some(b => b.id === episodeId),
          };
          
          console.log(`📱 Created episode for ${actualShowName} (source.id: ${episode.source.id}): ${episode.title}`);
          return episode;
        });
        
        console.log(`📱 Added ${convertedEpisodes.length} episodes from ${podcast.name}`);
        
        // Update status to completed
        setLoadingProgress(prev => prev.map((item, i) => 
          i === index ? { ...item, status: 'completed' as const, articlesCount: convertedEpisodes.length } : item
        ));
        
        return convertedEpisodes;
        
      } catch (error) {
        let errorMsg = 'Unknown error';
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMsg = 'Request timeout (15s)';
          } else {
            errorMsg = error.message;
          }
        } else {
          errorMsg = String(error);
        }
        
        console.error(`❌ Error processing podcast ${podcast.name}: ${errorMsg}`);
        
        // Update status to error
        setLoadingProgress(prev => prev.map((item, i) => 
          i === index ? { ...item, status: 'error' as const, error: errorMsg } : item
        ));
        return [];
      }
    });
    
    // Wait for all podcasts to complete (parallel execution)
    const podcastResults = await Promise.all(podcastPromises);
    const allEpisodes = podcastResults.flat();
    
    // Sort all episodes by publish date (newest first)
    const sortedEpisodes = allEpisodes.sort((a, b) => {
      return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
    });
    
    console.log(`📊 Returning ${sortedEpisodes.length} total podcast episodes`);
    return sortedEpisodes;

  }, [enabledPodcasts, isInitialized, getFeedLimits, bookmarks]);

  // useQuery must be called unconditionally - use enabled to control when it runs
  const { data: fetchedEpisodes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['podcast-episodes-v13', enabledPodcasts.map(p => p.id + p.enabled).join(''), isInitialized],
    queryFn: fetchAllEpisodes,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 5000,
    enabled: isInitialized, // Only run query after initialization
  });

  // Load data from storage and fetch available podcasts - useEffect #1
  useEffect(() => {
    const loadStoredDataAndPodcasts = async () => {
      try {
        console.log('🎙️ Loading stored data and fetching available podcast feeds...');
        
        // Fetch available podcasts from API and stored preferences in parallel
        const [availablePodcastsResult, storedEnabledPodcasts, storedBookmarks] = await Promise.all([
          fetchPodcastFeedSources().catch(error => {
            console.error('❌ Failed to fetch podcast feed sources:', error);
            return [];
          }),
          AsyncStorage.getItem(ENABLED_PODCASTS_STORAGE_KEY),
          AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY)
        ]);

        console.log(`📊 Fetched ${availablePodcastsResult.length} available podcast feeds from API`);
        
        // Convert to PodcastSource format with url field
        const podcastSources: PodcastSource[] = availablePodcastsResult.map(feed => ({
          ...feed,
          url: feed.url || `https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=${feed.apiCode}`
        }));
        
        setAvailablePodcasts(podcastSources);

        if (storedEnabledPodcasts && podcastSources.length > 0) {
          const storedPodcasts = JSON.parse(storedEnabledPodcasts);
          const mergedPodcasts = podcastSources.map(podcast => {
            const stored = storedPodcasts.find((p: PodcastSource) => p.id === podcast.id);
            return stored ? { ...podcast, enabled: stored.enabled } : podcast;
          });
          setEnabledPodcasts(mergedPodcasts);
          console.log(`📱 Merged ${mergedPodcasts.length} podcasts with stored preferences`);
        } else if (podcastSources.length > 0) {
          // No stored preferences, use defaults from API
          setEnabledPodcasts(podcastSources);
          console.log(`📱 Using default podcast configuration (${podcastSources.length} podcasts)`);
        }
        
        if (storedBookmarks) {
          setBookmarks(JSON.parse(storedBookmarks));
        }

        setIsInitialized(true);
        console.log('✅ Podcast store initialization completed');
      } catch (error) {
        console.error("Failed to load stored podcast data and feeds:", error);
        setIsInitialized(true);
      }
    };

    loadStoredDataAndPodcasts();
  }, []);

  // Save enabled podcasts to storage - useEffect #2
  useEffect(() => {
    if (!isInitialized) return;

    const saveEnabledPodcasts = async () => {
      try {
        await AsyncStorage.setItem(ENABLED_PODCASTS_STORAGE_KEY, JSON.stringify(enabledPodcasts));
      } catch (error) {
        console.error("Failed to save enabled podcasts:", error);
      }
    };

    saveEnabledPodcasts();
  }, [enabledPodcasts, isInitialized]);

  // Save bookmarks to storage - useEffect #3
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

  // Update allEpisodes when new data is fetched - useEffect #4
  useEffect(() => {
    if (fetchedEpisodes.length > 0) {
      console.log(`📱 Setting ${fetchedEpisodes.length} episodes in state`);
      // Update bookmark status for all episodes
      const episodesWithUpdatedBookmarks = fetchedEpisodes.map(episode => ({
        ...episode,
        isBookmarked: bookmarks.some(b => b.id === episode.id)
      }));
      setAllEpisodes(episodesWithUpdatedBookmarks);
      setCurrentPage(1);
    }
  }, [fetchedEpisodes, bookmarks]);

  // Calculate displayed episodes based on current page
  const episodes = allEpisodes.slice(0, currentPage * EPISODES_PER_PAGE);
  const hasMore = episodes.length < allEpisodes.length;

  const refreshPodcasts = useCallback(async () => {
    console.log('🔄 Refreshing podcast episodes...');
    setCurrentPage(1);
    await refetch();
  }, [refetch]);

  const loadMoreEpisodes = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      console.log(`📄 Loading more episodes... Current page: ${currentPage}, Total episodes: ${allEpisodes.length}`);
      setIsLoadingMore(true);
      
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, isLoadingMore, currentPage, allEpisodes.length]);

  const togglePodcastEnabled = useCallback((podcastId: string) => {
    console.log(`🔄 Toggling podcast: ${podcastId}`);
    setEnabledPodcasts(prev => {
      const podcast = prev.find(p => p.id === podcastId);
      if (!podcast) return prev;
      
      // If trying to enable a podcast, check subscription limits
      if (!podcast.enabled) {
        const currentEnabledCount = prev.filter(p => p.enabled).length;
        if (!canEnableMoreFeeds('podcasts', currentEnabledCount)) {
          console.log('Cannot enable more podcasts - subscription limit reached');
          return prev; // Don't allow enabling if limit reached
        }
      }
      
      const newPodcasts = prev.map(p => {
        if (p.id === podcastId) {
          const newState = !p.enabled;
          console.log(`${p.name} is now ${newState ? 'enabled' : 'disabled'}`);
          return { ...p, enabled: newState };
        }
        return p;
      });
      
      // Invalidate and refetch episodes when podcast enabled state changes
      setTimeout(() => {
        console.log('🔄 Invalidating podcast episodes query due to enabled state change');
        queryClient.invalidateQueries({ queryKey: ['podcast-episodes-v13'] });
      }, 100);
      
      return newPodcasts;
    });
  }, [canEnableMoreFeeds, queryClient]);

  const toggleBookmark = useCallback((episodeId: string) => {
    const episode = allEpisodes.find(e => e.id === episodeId);
    
    if (!episode) return;
    
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.id === episodeId);
      
      if (isBookmarked) {
        return prev.filter(b => b.id !== episodeId);
      } else {
        return [...prev, { ...episode, isBookmarked: true }];
      }
    });
    
    setAllEpisodes(prev => prev.map(e => {
      if (e.id === episodeId) {
        return { ...e, isBookmarked: !e.isBookmarked };
      }
      return e;
    }));
    
    queryClient.setQueryData(['podcast-episodes-v13', enabledPodcasts.map(p => p.id + p.enabled).join(''), isInitialized], (oldData: PodcastEpisode[] | undefined) => {
      if (!oldData) return allEpisodes;
      
      return oldData.map(e => {
        if (e.id === episodeId) {
          return { ...e, isBookmarked: !e.isBookmarked };
        }
        return e;
      });
    });
  }, [allEpisodes, queryClient, enabledPodcasts, isInitialized]);

  return useMemo(() => ({
    episodes,
    allEpisodes,
    bookmarks,
    isLoading: isLoading || !isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    enabledPodcasts,
    availablePodcasts,
    loadingProgress,
    refreshPodcasts,
    loadMoreEpisodes,
    togglePodcastEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
  }), [
    episodes,
    allEpisodes,
    bookmarks,
    isLoading,
    isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    enabledPodcasts,
    availablePodcasts,
    loadingProgress,
    refreshPodcasts,
    loadMoreEpisodes,
    togglePodcastEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
  ]);
});