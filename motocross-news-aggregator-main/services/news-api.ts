import { Article } from '@/types/article';

// Utility function to clean HTML entities and limit excerpt length
function cleanExcerpt(excerpt: string): string {
  if (!excerpt || typeof excerpt !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let cleaned = excerpt.replace(/<[^>]*>/g, ' ');
  
  // Decode common HTML entities
  const htmlEntities: { [key: string]: string } = {
    '&#8230;': '...',
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&#8211;': '–',
    '&#8212;': '—',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  
  // Replace HTML entities
  Object.entries(htmlEntities).forEach(([entity, replacement]) => {
    cleaned = cleaned.replace(new RegExp(entity, 'g'), replacement);
  });
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Limit length to 150 characters and add ellipsis if needed
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 147).trim() + '...';
  }
  
  return cleaned;
}

const API_BASE_URL = 'https://rss-feed-podcasts.vercel.app';

export interface NewsAPIResponse {
  articles: Article[];
  total: number;
  page: number;
  limit: number;
}

export interface NewsAPIError {
  error: string;
  message?: string;
}

export async function fetchArticlesBySource(
  sourceCode: string,
  limit: number = 10,
  offset: number = 0
): Promise<Article[]> {
  try {
    const url = `${API_BASE_URL}/api/articles?group_by_source=${sourceCode}&limit=${limit}&offset=${offset}`;
    console.log(`📰 Fetching articles from ${sourceCode}:`, url);
    
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

    // Transform the API response to match our Article interface
    // The API returns data in { success: true, data: [...] } format
    console.log(`📊 Raw API response for ${sourceCode}:`, { 
      dataType: typeof data, 
      hasSuccess: 'success' in data,
      hasData: 'data' in data,
      dataLength: data?.data?.length 
    });
    
    // Handle multiple possible API response formats
    let rawArticles: any[] = [];
    
    if (data?.success && Array.isArray(data?.data)) {
      // Format: { success: true, data: [...] }
      rawArticles = data.data;
    } else if (Array.isArray(data?.data)) {
      // Format: { data: [...] }
      rawArticles = data.data;
    } else if (Array.isArray(data?.articles)) {
      // Format: { articles: [...] }
      rawArticles = data.articles;
    } else if (Array.isArray(data)) {
      // Format: [...]
      rawArticles = data;
    } else if (data && typeof data === 'object') {
      // Try to find any array property in the response
      const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
      if (arrayKeys.length > 0) {
        console.log(`📊 Found array property '${arrayKeys[0]}' in response for ${sourceCode}`);
        rawArticles = data[arrayKeys[0]];
      } else {
        console.warn(`⚠️ No array found in API response for ${sourceCode}:`, {
          dataType: typeof data,
          keys: Object.keys(data),
          hasSuccess: 'success' in data,
          hasData: 'data' in data,
          hasArticles: 'articles' in data
        });
        return [];
      }
    } else {
      console.warn(`⚠️ Unexpected API response format for ${sourceCode}:`, {
        dataType: typeof data,
        hasSuccess: 'success' in data,
        hasData: 'data' in data,
        isArray: Array.isArray(data)
      });
      return [];
    }
    
    if (!Array.isArray(rawArticles)) {
      console.warn(`⚠️ Expected array but got ${typeof rawArticles} for ${sourceCode}`);
      return [];
    }
    
    const articles: Article[] = rawArticles.map((item: any, index: number) => {
      try {
        // Use image_url directly without any filtering
        let imageUrl = item.image_url || '';
        
        // Handle JSON-encoded image URLs
        if (imageUrl && typeof imageUrl === 'string') {
          try {
            // Check if it's a JSON string (starts with [ or ")
            if (imageUrl.startsWith('[') || imageUrl.startsWith('"')) {
              const parsed = JSON.parse(imageUrl);
              if (Array.isArray(parsed) && parsed.length > 0) {
                imageUrl = parsed[0];
              } else if (typeof parsed === 'string') {
                imageUrl = parsed;
              }
            }
          } catch (_) {
            // If JSON parsing fails, use the original string
            console.log(`📷 Could not parse image URL for ${sourceCode}:`, imageUrl);
          }
        }
        
        console.log(`📷 Using image URL for ${sourceCode}:`, imageUrl);

        return {
          id: item.id?.toString() || `${sourceCode}-${item.title || index}-${Date.now()}`,
          title: item.title || 'Untitled',
          description: cleanExcerpt(item.excerpt || item.description || ''),
          content: item.excerpt || item.description || '',
          link: item.article_url || item.link || '',
          publishDate: item.published_date || item.publishDate || new Date().toISOString(),
          imageUrl,
          author: item.author || item.creator || item.byline || undefined,
          source: {
            id: sourceCode.toLowerCase(),
            name: item.company || sourceCode,
            logo: imageUrl,
          },
          isBookmarked: false,
        };
      } catch (error) {
        console.error(`❌ Error processing article ${index} from ${sourceCode}:`, error, item);
        return {
          id: `${sourceCode}-error-${index}-${Date.now()}`,
          title: 'Error loading article',
          description: 'This article could not be loaded properly',
          content: 'This article could not be loaded properly',
          link: '',
          publishDate: new Date().toISOString(),
          imageUrl: '',
          source: {
            id: sourceCode.toLowerCase(),
            name: sourceCode,
            logo: '',
          },
          isBookmarked: false,
        };
      }
    }).filter(article => article.title !== 'Error loading article'); // Filter out error articles

    console.log(`✅ Successfully fetched ${articles.length} articles from ${sourceCode}`);
    return articles;
    
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
    
    console.error(`❌ Error fetching articles from ${sourceCode}:`, errorMsg);
    throw new Error(`Failed to fetch ${sourceCode}: ${errorMsg}`);
  }
}

export async function fetchAllArticles(
  limit: number = 50,
  offset: number = 0,
  search?: string
): Promise<Article[]> {
  try {
    let url = `${API_BASE_URL}/api/articles?limit=${limit}&offset=${offset}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    
    console.log(`📰 Fetching all articles:`, url);
    
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

    // Transform the API response to match our Article interface
    console.log(`📊 Raw API response for all articles:`, { 
      dataType: typeof data, 
      hasSuccess: 'success' in data,
      hasData: 'data' in data,
      dataLength: data?.data?.length 
    });
    
    // Handle multiple possible API response formats
    let rawArticles: any[] = [];
    
    if (data?.success && Array.isArray(data?.data)) {
      // Format: { success: true, data: [...] }
      rawArticles = data.data;
    } else if (Array.isArray(data?.data)) {
      // Format: { data: [...] }
      rawArticles = data.data;
    } else if (Array.isArray(data?.articles)) {
      // Format: { articles: [...] }
      rawArticles = data.articles;
    } else if (Array.isArray(data)) {
      // Format: [...]
      rawArticles = data;
    } else if (data && typeof data === 'object') {
      // Try to find any array property in the response
      const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
      if (arrayKeys.length > 0) {
        console.log(`📊 Found array property '${arrayKeys[0]}' in response for all articles`);
        rawArticles = data[arrayKeys[0]];
      } else {
        console.warn(`⚠️ No array found in API response for all articles:`, {
          dataType: typeof data,
          keys: Object.keys(data),
          hasSuccess: 'success' in data,
          hasData: 'data' in data,
          hasArticles: 'articles' in data
        });
        return [];
      }
    } else {
      console.warn(`⚠️ Unexpected API response format for all articles:`, {
        dataType: typeof data,
        hasSuccess: 'success' in data,
        hasData: 'data' in data,
        isArray: Array.isArray(data)
      });
      return [];
    }
    
    if (!Array.isArray(rawArticles)) {
      console.warn(`⚠️ Expected array but got ${typeof rawArticles} for all articles`);
      return [];
    }
    
    const articles: Article[] = rawArticles.map((item: any) => {
      // Use image_url directly without any filtering
      let imageUrl = item.image_url || '';
      
      // Handle JSON-encoded image URLs
      if (imageUrl && typeof imageUrl === 'string') {
        try {
          // Check if it's a JSON string (starts with [ or ")
          if (imageUrl.startsWith('[') || imageUrl.startsWith('"')) {
            const parsed = JSON.parse(imageUrl);
            if (Array.isArray(parsed) && parsed.length > 0) {
              imageUrl = parsed[0];
            } else if (typeof parsed === 'string') {
              imageUrl = parsed;
            }
          }
        } catch (_) {
          // If JSON parsing fails, use the original string
        }
      }

      return {
        id: item.id?.toString() || `${Date.now()}-${item.title}`,
        title: item.title || 'Untitled',
        description: cleanExcerpt(item.excerpt || item.description || ''),
        content: item.excerpt || item.description || '',
        link: item.article_url || item.link || '',
        publishDate: item.published_date || item.publishDate || new Date().toISOString(),
        imageUrl,
        author: item.author || item.creator || item.byline || undefined,
        source: {
          id: item.company?.toLowerCase() || 'unknown',
          name: item.company || 'Unknown Source',
          logo: imageUrl,
        },
        isBookmarked: false,
      };
    });

    console.log(`✅ Successfully fetched ${articles.length} articles`);
    return articles;
    
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
    
    console.error(`❌ Error fetching all articles:`, errorMsg);
    throw new Error(`Failed to fetch articles: ${errorMsg}`);
  }
}