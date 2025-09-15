// services/feed-sources-api.ts - Dynamic Feed Sources API
export interface FeedSource {
  id: string;
  name: string;
  apiCode?: string;
  url?: string;
  logo?: string;
  category: string;
  enabled: boolean;
  type: 'news' | 'podcasts' | 'youtube';
  priority: number;
}

export interface FeedSourcesResponse {
  success: boolean;
  data: {
    news?: FeedSource[];
    podcasts?: FeedSource[];
    youtube?: FeedSource[];
  } | FeedSource[];
  type?: string;
  types?: string[];
}

const API_BASE_URL = 'https://rss-feed-podcasts.vercel.app';

export async function fetchFeedSources(type?: 'news' | 'podcasts' | 'youtube'): Promise<FeedSource[]> {
  try {
    let url = `${API_BASE_URL}/api/feed-sources`;
    if (type) {
      url += `?type=${type}`;
    }
    
    console.log(`🔍 Fetching feed sources${type ? ` for ${type}` : ''}:`, url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
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

    const data: FeedSourcesResponse = await response.json();
    
    if (!data.success) {
      throw new Error('API returned error');
    }

    console.log(`📊 Raw feed sources response:`, {
      hasData: 'data' in data,
      type: data.type,
      types: data.types,
      dataKeys: typeof data.data === 'object' && !Array.isArray(data.data) ? Object.keys(data.data) : 'array'
    });

    // Handle response format
    let feedSources: FeedSource[] = [];
    
    if (type) {
      // Single type requested
      feedSources = Array.isArray(data.data) ? data.data : [];
    } else {
      // All types requested - flatten the response
      if (typeof data.data === 'object' && !Array.isArray(data.data)) {
        const allFeeds = data.data as { news?: FeedSource[]; podcasts?: FeedSource[]; youtube?: FeedSource[] };
        feedSources = [
          ...(allFeeds.news || []),
          ...(allFeeds.podcasts || []),
          ...(allFeeds.youtube || [])
        ];
      }
    }

    console.log(`✅ Successfully fetched ${feedSources.length} feed sources${type ? ` for ${type}` : ''}`);
    return feedSources;
    
  } catch (error) {
    let errorMsg = 'Unknown error';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMsg = 'Request timeout (10s)';
      } else {
        errorMsg = error.message;
      }
    } else {
      errorMsg = String(error);
    }
    
    console.error(`❌ Error fetching feed sources${type ? ` for ${type}` : ''}:`, errorMsg);
    throw new Error(`Failed to fetch feed sources: ${errorMsg}`);
  }
}

export async function fetchNewsFeedSources(): Promise<FeedSource[]> {
  return fetchFeedSources('news');
}

export async function fetchPodcastFeedSources(): Promise<FeedSource[]> {
  return fetchFeedSources('podcasts');
}

export async function fetchYouTubeFeedSources(): Promise<FeedSource[]> {
  return fetchFeedSources('youtube');
}

export async function fetchAllFeedSources(): Promise<{
  news: FeedSource[];
  podcasts: FeedSource[];
  youtube: FeedSource[];
}> {
  try {
    // Fetch all types in parallel for better performance
    const [newsFeeds, podcastFeeds, youtubeFeeds] = await Promise.all([
      fetchNewsFeedSources(),
      fetchPodcastFeedSources(),
      fetchYouTubeFeedSources()
    ]);

    return {
      news: newsFeeds,
      podcasts: podcastFeeds,
      youtube: youtubeFeeds
    };
  } catch (error) {
    console.error('❌ Error fetching all feed sources:', error);
    throw error;
  }
}
