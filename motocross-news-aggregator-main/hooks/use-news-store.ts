import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useState, useMemo } from "react";

import { Article } from "@/types/article";
import { fetchArticlesBySource } from "@/services/news-api";
import { fetchNewsFeedSources, FeedSource } from "@/services/feed-sources-api";
import { useSubscription } from "@/hooks/use-subscription";

const BOOKMARKS_STORAGE_KEY = "mx-news-bookmarks";
const ENABLED_FEEDS_STORAGE_KEY = "mx-news-enabled-feeds";
const ARTICLES_PER_PAGE = 15;

// API performance optimizations - reduced for faster loading
const MAX_ARTICLES_PER_FEED = 15;

interface LoadingProgress {
  feedName: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  articlesCount?: number;
  error?: string;
}

export const [NewsProvider, useNewsStore] = createContextHook(() => {
  // All hooks MUST be called in the same order every render
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [enabledFeeds, setEnabledFeeds] = useState<FeedSource[]>([]);
  const [availableFeeds, setAvailableFeeds] = useState<FeedSource[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress[]>([]);
  
  // All other hooks must be called unconditionally in the same order
  const queryClient = useQueryClient();
  const { getFeedLimits, canEnableMoreFeeds } = useSubscription();

  const fetchAllArticles = useCallback(async (): Promise<Article[]> => {
    if (!isInitialized) {
      console.log('🚫 Not initialized yet, returning empty array');
      return [];
    }

    const feedLimits = getFeedLimits();
    const maxFeeds = feedLimits.news === -1 ? enabledFeeds.length : feedLimits.news;
    const activeFeeds = enabledFeeds
      .filter(feed => feed.enabled)
      .slice(0, maxFeeds);
    
    if (activeFeeds.length === 0) {
      console.log('⚠️ No active feeds enabled');
      setLoadingProgress([]);
      return [];
    }

    console.log(`📰 Fetching articles from ${activeFeeds.length} feed(s)...`);
    
    // Initialize loading progress
    const initialProgress: LoadingProgress[] = activeFeeds.map(feed => ({
      feedName: feed.name,
      status: 'pending' as const
    }));
    setLoadingProgress(initialProgress);
    
    // Fetch all feeds in parallel for much faster loading
    const feedPromises = activeFeeds.map(async (feed, index) => {
      // Update status to loading
      setLoadingProgress(prev => prev.map((item, i) => 
        i === index ? { ...item, status: 'loading' as const } : item
      ));
      
      try {
        console.log(`🔄 Fetching data for ${feed.name}`);
        console.log(`📡 API Code: ${feed.apiCode}`);
        
        const articles = await fetchArticlesBySource(feed.apiCode, MAX_ARTICLES_PER_FEED);
        
        if (articles.length === 0) {
          console.log(`⚠️ No articles found for ${feed.name}, skipping...`);
          // Update status to completed with 0 articles
          setLoadingProgress(prev => prev.map((item, i) => 
            i === index ? { ...item, status: 'completed' as const, articlesCount: 0 } : item
          ));
          return [];
        }
        
        // Convert data to articles with proper source info and bookmark status
        const convertedArticles = articles.map((article: Article) => ({
          ...article,
          source: {
            id: feed.id,
            name: feed.name,
            logo: feed.logo,
          },
          isBookmarked: bookmarks.some(b => b.id === article.id),
        }));
        
        console.log(`📱 Added ${convertedArticles.length} articles from ${feed.name}`);
        
        // Update status to completed
        setLoadingProgress(prev => prev.map((item, i) => 
          i === index ? { ...item, status: 'completed' as const, articlesCount: convertedArticles.length } : item
        ));
        
        return convertedArticles;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing feed ${feed.name}: ${errorMsg}`);
        
        // Update status to error
        setLoadingProgress(prev => prev.map((item, i) => 
          i === index ? { ...item, status: 'error' as const, error: errorMsg } : item
        ));
        return [];
      }
    });
    
    // Wait for all feeds to complete (parallel execution)
    const feedResults = await Promise.all(feedPromises);
    const allArticles = feedResults.flat();
    
    // Sort all articles by publish date (newest first)
    const sortedArticles = allArticles.sort((a, b) => {
      return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
    });
    
    console.log(`📊 Returning ${sortedArticles.length} total articles`);
    return sortedArticles;

  }, [enabledFeeds, isInitialized, getFeedLimits, bookmarks]);

  // useQuery must be called unconditionally - use enabled to control when it runs
  const { data: fetchedArticles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['news-articles-v2', enabledFeeds.map(f => f.id + f.enabled).join(''), isInitialized],
    queryFn: fetchAllArticles,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 5000,
    enabled: isInitialized, // Only run query after initialization
  });

  // Load data from storage and fetch available feeds - useEffect #1
  useEffect(() => {
    const loadStoredDataAndFeeds = async () => {
      try {
        console.log('📰 Loading stored data and fetching available news feeds...');
        
        // Fetch available feeds from API and stored preferences in parallel
        const [availableFeedsResult, storedBookmarks, storedEnabledFeeds] = await Promise.all([
          fetchNewsFeedSources().catch(error => {
            console.error('❌ Failed to fetch news feed sources:', error);
            return [];
          }),
          AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY),
          AsyncStorage.getItem(ENABLED_FEEDS_STORAGE_KEY)
        ]);

        console.log(`📊 Fetched ${availableFeedsResult.length} available news feeds from API`);
        setAvailableFeeds(availableFeedsResult);

        if (storedBookmarks) {
          setBookmarks(JSON.parse(storedBookmarks));
        }

        if (storedEnabledFeeds && availableFeedsResult.length > 0) {
          const storedFeeds = JSON.parse(storedEnabledFeeds);
          const mergedFeeds = availableFeedsResult.map(feed => {
            const stored = storedFeeds.find((f: FeedSource) => f.id === feed.id);
            return stored ? { ...feed, enabled: stored.enabled } : feed;
          });
          setEnabledFeeds(mergedFeeds);
          console.log(`📱 Merged ${mergedFeeds.length} feeds with stored preferences`);
        } else if (availableFeedsResult.length > 0) {
          // No stored preferences, use defaults from API
          setEnabledFeeds(availableFeedsResult);
          console.log(`📱 Using default feed configuration (${availableFeedsResult.length} feeds)`);
        }

        setIsInitialized(true);
        console.log('✅ News store initialization completed');
      } catch (error) {
        console.error("Failed to load stored news data and feeds:", error);
        setIsInitialized(true);
      }
    };

    loadStoredDataAndFeeds();
  }, []);

  // Save enabled feeds to storage - useEffect #2
  useEffect(() => {
    if (!isInitialized) return;

    const saveEnabledFeeds = async () => {
      try {
        await AsyncStorage.setItem(ENABLED_FEEDS_STORAGE_KEY, JSON.stringify(enabledFeeds));
      } catch (error) {
        console.error("Failed to save enabled feeds:", error);
      }
    };

    saveEnabledFeeds();
  }, [enabledFeeds, isInitialized]);

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

  // Update allArticles when new data is fetched - useEffect #4
  useEffect(() => {
    if (fetchedArticles.length > 0) {
      console.log(`📱 Setting ${fetchedArticles.length} articles in state`);
      // Update bookmark status for all articles
      const articlesWithUpdatedBookmarks = fetchedArticles.map(article => ({
        ...article,
        isBookmarked: bookmarks.some(b => b.id === article.id)
      }));
      setAllArticles(articlesWithUpdatedBookmarks);
      setCurrentPage(1);
    }
  }, [fetchedArticles, bookmarks]);

  // Calculate displayed articles based on current page
  const articles = allArticles.slice(0, currentPage * ARTICLES_PER_PAGE);
  const hasMore = articles.length < allArticles.length;

  const refreshFeeds = useCallback(async () => {
    console.log('🔄 Refreshing news articles...');
    setCurrentPage(1);
    await refetch();
  }, [refetch]);

  const loadMoreArticles = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      console.log(`📄 Loading more articles... Current page: ${currentPage}, Total articles: ${allArticles.length}`);
      setIsLoadingMore(true);
      
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, isLoadingMore, currentPage, allArticles.length]);

  const toggleFeedEnabled = useCallback((feedId: string) => {
    console.log(`🔄 Toggling feed: ${feedId}`);
    setEnabledFeeds(prev => {
      const feed = prev.find(f => f.id === feedId);
      if (!feed) return prev;
      
      // If trying to enable a feed, check subscription limits
      if (!feed.enabled) {
        const currentEnabledCount = prev.filter(f => f.enabled).length;
        if (!canEnableMoreFeeds('news', currentEnabledCount)) {
          console.log('Cannot enable more news feeds - subscription limit reached');
          return prev; // Don't allow enabling if limit reached
        }
      }
      
      return prev.map(f => {
        if (f.id === feedId) {
          const newState = !f.enabled;
          console.log(`${f.name} is now ${newState ? 'enabled' : 'disabled'}`);
          return { ...f, enabled: newState };
        }
        return f;
      });
    });
  }, [canEnableMoreFeeds]);

  const toggleBookmark = useCallback((articleId: string) => {
    const article = allArticles.find(a => a.id === articleId);
    
    if (!article) return;
    
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.id === articleId);
      
      if (isBookmarked) {
        return prev.filter(b => b.id !== articleId);
      } else {
        return [...prev, { ...article, isBookmarked: true }];
      }
    });
    
    setAllArticles(prev => prev.map(a => {
      if (a.id === articleId) {
        return { ...a, isBookmarked: !a.isBookmarked };
      }
      return a;
    }));
    
    queryClient.setQueryData(['news-articles-v2', enabledFeeds.map(f => f.id + f.enabled).join(''), isInitialized], (oldData: Article[] | undefined) => {
      if (!oldData) return allArticles;
      
      return oldData.map(a => {
        if (a.id === articleId) {
          return { ...a, isBookmarked: !a.isBookmarked };
        }
        return a;
      });
    });
  }, [allArticles, queryClient, enabledFeeds, isInitialized]);

  return useMemo(() => ({
    articles,
    allArticles,
    bookmarks,
    isLoading: isLoading || !isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    enabledFeeds,
    availableFeeds,
    loadingProgress,
    refreshFeeds,
    loadMoreArticles,
    toggleFeedEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
  }), [
    articles,
    allArticles,
    bookmarks,
    isLoading,
    isInitialized,
    isLoadingMore,
    isError,
    hasMore,
    currentPage,
    enabledFeeds,
    availableFeeds,
    loadingProgress,
    refreshFeeds,
    loadMoreArticles,
    toggleFeedEnabled,
    toggleBookmark,
    getFeedLimits,
    canEnableMoreFeeds,
  ]);
});