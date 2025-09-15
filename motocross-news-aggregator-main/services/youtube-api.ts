import { YouTubeVideo } from '@/types/youtube';

const API_BASE_URL = 'https://rss-feed-podcasts.vercel.app';

// Utility function to parse ISO 8601 duration
function parseDuration(duration: string): string {
  if (!duration || typeof duration !== 'string') {
    return '0:00';
  }
  
  // Parse ISO 8601 duration (PT4M13S -> 4:13)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function fetchVideosByChannel(
  channelCode: string,
  limit: number = 10,
  offset: number = 0
): Promise<YouTubeVideo[]> {
  try {
    const url = `${API_BASE_URL}/api/youtube?channel_id=${channelCode}&limit=${limit}&offset=${offset}`;
    console.log(`🎥 Fetching videos from ${channelCode}:`, url);
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
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

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.message || data.error);
    }

    // Transform the API response to match our YouTubeVideo interface
    console.log(`📊 Raw API response for ${channelCode}:`, { 
      dataType: typeof data, 
      hasSuccess: 'success' in data,
      hasData: 'data' in data,
      dataLength: data?.data?.length 
    });
    
    // Handle multiple possible API response formats
    let rawVideos: any[] = [];
    
    if (data?.success && Array.isArray(data?.data)) {
      // Format: { success: true, data: [...] }
      rawVideos = data.data;
    } else if (Array.isArray(data?.data)) {
      // Format: { data: [...] }
      rawVideos = data.data;
    } else if (Array.isArray(data)) {
      // Format: [...]
      rawVideos = data;
    } else if (data && typeof data === 'object') {
      // Try to find any array property in the response
      const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
      if (arrayKeys.length > 0) {
        console.log(`📊 Found array property '${arrayKeys[0]}' in response for ${channelCode}`);
        rawVideos = data[arrayKeys[0]];
      } else {
        console.warn(`⚠️ No array found in API response for ${channelCode}:`, {
          dataType: typeof data,
          keys: Object.keys(data),
          hasSuccess: 'success' in data,
          hasData: 'data' in data
        });
        return [];
      }
    } else {
      console.warn(`⚠️ Unexpected API response format for ${channelCode}:`, {
        dataType: typeof data,
        hasSuccess: 'success' in data,
        hasData: 'data' in data,
        isArray: Array.isArray(data)
      });
      return [];
    }
    
    if (!Array.isArray(rawVideos)) {
      console.warn(`⚠️ Expected array but got ${typeof rawVideos} for ${channelCode}`);
      return [];
    }
    
    const videos: YouTubeVideo[] = rawVideos.map((item: any, index: number) => {
      try {
        return {
          id: item.id?.toString() || `${channelCode}-${item.title || index}-${Date.now()}`,
          channelId: item.channelId || '',
          channelName: item.channelName || channelCode,
          title: item.title || 'Untitled Video',
          description: item.description || '',
          publishedAt: item.publishedAt || new Date().toISOString(),
          thumbnailUrl: item.thumbnailUrl || 'https://via.placeholder.com/480x360?text=No+Thumbnail',
          duration: parseDuration(item.duration || 'PT0S'),
          embedUrl: item.embedUrl || `https://www.youtube.com/embed/${item.id}`,
          watchUrl: item.watchUrl || `https://www.youtube.com/watch?v=${item.id}`,
          embedHtml: item.embedHtml || '',
          isBookmarked: false,
        };
      } catch (error) {
        console.error(`❌ Error processing video ${index} from ${channelCode}:`, error, item);
        return {
          id: `${channelCode}-error-${index}-${Date.now()}`,
          channelId: '',
          channelName: channelCode,
          title: 'Error loading video',
          description: 'This video could not be loaded properly',
          publishedAt: new Date().toISOString(),
          thumbnailUrl: 'https://via.placeholder.com/480x360?text=Error',
          duration: '0:00',
          embedUrl: '',
          watchUrl: '',
          embedHtml: '',
          isBookmarked: false,
        };
      }
    }).filter(video => video.title !== 'Error loading video'); // Filter out error videos

    console.log(`✅ Successfully fetched ${videos.length} videos from ${channelCode}`);
    return videos;
    
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
    
    console.error(`❌ Error fetching videos from ${channelCode}:`, errorMsg);
    throw new Error(`Failed to fetch ${channelCode}: ${errorMsg}`);
  }
}

export async function fetchAllVideos(
  limit: number = 50,
  offset: number = 0,
  search?: string
): Promise<YouTubeVideo[]> {
  try {
    let url = `${API_BASE_URL}/api/youtube?limit=${limit}&offset=${offset}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    
    console.log(`🎥 Fetching all videos:`, url);
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
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

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.message || data.error);
    }

    // Transform the API response to match our YouTubeVideo interface
    console.log(`📊 Raw API response for all videos:`, { 
      dataType: typeof data, 
      hasSuccess: 'success' in data,
      hasData: 'data' in data,
      dataLength: data?.data?.length 
    });
    
    // Handle multiple possible API response formats
    let rawVideos: any[] = [];
    
    if (data?.success && Array.isArray(data?.data)) {
      // Format: { success: true, data: [...] }
      rawVideos = data.data;
    } else if (Array.isArray(data?.data)) {
      // Format: { data: [...] }
      rawVideos = data.data;
    } else if (Array.isArray(data)) {
      // Format: [...]
      rawVideos = data;
    } else if (data && typeof data === 'object') {
      // Try to find any array property in the response
      const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
      if (arrayKeys.length > 0) {
        console.log(`📊 Found array property '${arrayKeys[0]}' in response for all videos`);
        rawVideos = data[arrayKeys[0]];
      } else {
        console.warn(`⚠️ No array found in API response for all videos:`, {
          dataType: typeof data,
          keys: Object.keys(data),
          hasSuccess: 'success' in data,
          hasData: 'data' in data
        });
        return [];
      }
    } else {
      console.warn(`⚠️ Unexpected API response format for all videos:`, {
        dataType: typeof data,
        hasSuccess: 'success' in data,
        hasData: 'data' in data,
        isArray: Array.isArray(data)
      });
      return [];
    }
    
    if (!Array.isArray(rawVideos)) {
      console.warn(`⚠️ Expected array but got ${typeof rawVideos} for all videos`);
      return [];
    }
    
    const videos: YouTubeVideo[] = rawVideos.map((item: any) => {
      return {
        id: item.id?.toString() || `${Date.now()}-${item.title}`,
        channelId: item.channelId || '',
        channelName: item.channelName || 'Unknown Channel',
        title: item.title || 'Untitled Video',
        description: item.description || '',
        publishedAt: item.publishedAt || new Date().toISOString(),
        thumbnailUrl: item.thumbnailUrl || 'https://via.placeholder.com/480x360?text=No+Thumbnail',
        duration: parseDuration(item.duration || 'PT0S'),
        embedUrl: item.embedUrl || `https://www.youtube.com/embed/${item.id}`,
        watchUrl: item.watchUrl || `https://www.youtube.com/watch?v=${item.id}`,
        embedHtml: item.embedHtml || '',
        isBookmarked: false,
      };
    });

    console.log(`✅ Successfully fetched ${videos.length} videos`);
    return videos;
    
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
    
    console.error(`❌ Error fetching all videos:`, errorMsg);
    throw new Error(`Failed to fetch videos: ${errorMsg}`);
  }
}