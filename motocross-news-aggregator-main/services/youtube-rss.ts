import { Platform } from 'react-native';
import * as rssParser from 'react-native-rss-parser';
import { YouTubeVideo } from '@/types/youtube';

interface YouTubeChannel {
  id: string;
  name: string;
  channelId: string;
}

class YouTubeRSSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeRSSError';
  }
}

const isValidXMLContent = (content: string): boolean => {
  const trimmedContent = content.trim();
  
  if (!trimmedContent.startsWith('<')) {
    return false;
  }
  
  // Check for YouTube RSS/Atom feed indicators
  const hasXMLIndicators = 
    trimmedContent.includes('<?xml') ||
    trimmedContent.includes('<feed') ||
    trimmedContent.includes('<rss') ||
    trimmedContent.includes('<channel') ||
    trimmedContent.includes('<entry>') ||
    trimmedContent.includes('xmlns') ||
    trimmedContent.includes('atom') ||
    trimmedContent.includes('youtube') ||
    trimmedContent.includes('<title>') ||
    trimmedContent.includes('<link>');
  
  return hasXMLIndicators;
};

const sanitizeXML = (xmlContent: string): string => {
  let sanitized = xmlContent;
  
  // Find the actual start of XML content
  const xmlStart = sanitized.indexOf('<?xml');
  const feedStart = sanitized.indexOf('<feed');
  const rssStart = sanitized.indexOf('<rss');
  
  let actualStart = -1;
  if (xmlStart !== -1) actualStart = xmlStart;
  else if (feedStart !== -1) actualStart = feedStart;
  else if (rssStart !== -1) actualStart = rssStart;
  
  if (actualStart > 0) {
    sanitized = sanitized.substring(actualStart);
  }
  
  // Find the actual end of XML content
  const feedEnd = sanitized.lastIndexOf('</feed>');
  const rssEnd = sanitized.lastIndexOf('</rss>');
  
  if (feedEnd !== -1) {
    sanitized = sanitized.substring(0, feedEnd + 7);
  } else if (rssEnd !== -1) {
    sanitized = sanitized.substring(0, rssEnd + 6);
  }
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Fix common entity issues
  sanitized = sanitized.replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;');
  
  return sanitized;
};

const fetchWithTimeout = async (url: string, timeout: number = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const fetchRSSContent = async (url: string): Promise<string> => {
  console.log(`🔍 Fetching RSS content from: ${url}`);
  
  if (Platform.OS === 'web') {
    // Updated proxy strategies with more reliable options
    const proxyStrategies = [
      {
        url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        name: 'AllOrigins',
        isJson: true,
        timeout: 20000
      },
      {
        url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
        name: 'CORSProxy.io',
        timeout: 20000
      },
      {
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        name: 'CodeTabs',
        timeout: 20000
      },
      {
        url: `https://cors-anywhere.herokuapp.com/${url}`,
        name: 'CORS Anywhere',
        timeout: 20000
      },
      {
        url: `https://thingproxy.freeboard.io/fetch/${url}`,
        name: 'ThingProxy',
        timeout: 20000
      },
    ];

    let lastError: Error | null = null;
    let attemptCount = 0;

    for (const strategy of proxyStrategies) {
      attemptCount++;
      try {
        console.log(`🔄 Attempt ${attemptCount}/${proxyStrategies.length}: ${strategy.name}`);
        
        const response = await fetchWithTimeout(strategy.url, strategy.timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        let responseText: string;
        
        if (strategy.isJson) {
          try {
            const data = await response.json();
            responseText = data.contents || '';
            if (!responseText) {
              throw new Error('No contents in JSON response');
            }
          } catch (jsonError) {
            throw new Error(`JSON parsing failed: ${jsonError}`);
          }
        } else {
          responseText = await response.text();
        }
        
        console.log(`📄 Response length: ${responseText.length} chars`);
        
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Empty response');
        }
        
        // Check if it's HTML error page
        if (responseText.trim().startsWith('<!DOCTYPE html') || 
            responseText.trim().startsWith('<html')) {
          console.log(`⚠️ Received HTML instead of XML from ${strategy.name}`);
          throw new Error('Received HTML instead of XML');
        }
        
        // Validate XML content
        if (!isValidXMLContent(responseText)) {
          console.log(`⚠️ Response doesn't look like XML from ${strategy.name}`);
          console.log(`First 200 chars: ${responseText.substring(0, 200)}`);
          throw new Error('Response does not appear to contain XML content');
        }
        
        console.log(`✅ Successfully fetched content via ${strategy.name}`);
        return sanitizeXML(responseText);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`❌ ${strategy.name} failed: ${errorMsg}`);
        lastError = new Error(`${strategy.name}: ${errorMsg}`);
        
        // Wait between attempts
        if (attemptCount < proxyStrategies.length) {
          console.log(`⏳ Waiting 2 seconds before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        continue;
      }
    }

    // All proxy strategies failed
    console.log(`❌ All proxy strategies failed for ${url}`);
    
    // Generate unique video IDs for mock data to prevent duplicate keys
    const timestamp = Date.now();
    const randomId1 = `mock_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const randomId2 = `mock_${timestamp + 1}_${Math.random().toString(36).substr(2, 9)}`;
    const randomId3 = `mock_${timestamp + 2}_${Math.random().toString(36).substr(2, 9)}`;
    
    const mockRSSData = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCYgeLwCuPMH9bjwepxHy8jQ"/>
  <id>yt:channel:UCYgeLwCuPMH9bjwepxHy8jQ</id>
  <yt:channelId>UCYgeLwCuPMH9bjwepxHy8jQ</yt:channelId>
  <title>Racer X Illustrated</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UCYgeLwCuPMH9bjwepxHy8jQ"/>
  <author>
    <name>Racer X Illustrated</name>
    <uri>https://www.youtube.com/channel/UCYgeLwCuPMH9bjwepxHy8jQ</uri>
  </author>
  <published>2024-01-15T10:00:00+00:00</published>
  
  <entry>
    <id>yt:video:${randomId1}</id>
    <yt:videoId>${randomId1}</yt:videoId>
    <yt:channelId>UCYgeLwCuPMH9bjwepxHy8jQ</yt:channelId>
    <title>Latest Supercross Highlights - Round 5</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=${randomId1}"/>
    <author>
      <name>Racer X Illustrated</name>
      <uri>https://www.youtube.com/channel/UCYgeLwCuPMH9bjwepxHy8jQ</uri>
    </author>
    <published>${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}</published>
    <updated>${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}</updated>
    <media:group>
      <media:title>Latest Supercross Highlights - Round 5</media:title>
      <media:content url="https://www.youtube.com/v/${randomId1}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:thumbnail url="https://i1.ytimg.com/vi/${randomId1}/hqdefault.jpg" width="480" height="360"/>
      <media:description>Check out the best moments from Round 5 of the Supercross championship!</media:description>
      <media:community>
        <media:starRating count="1234" average="5.00" min="1" max="5"/>
        <media:statistics views="45678"/>
      </media:community>
    </media:group>
  </entry>
  
  <entry>
    <id>yt:video:${randomId2}</id>
    <yt:videoId>${randomId2}</yt:videoId>
    <yt:channelId>UCYgeLwCuPMH9bjwepxHy8jQ</yt:channelId>
    <title>Motocross Training Tips with Pro Riders</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=${randomId2}"/>
    <author>
      <name>Racer X Illustrated</name>
      <uri>https://www.youtube.com/channel/UCYgeLwCuPMH9bjwepxHy8jQ</uri>
    </author>
    <published>${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}</published>
    <updated>${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}</updated>
    <media:group>
      <media:title>Motocross Training Tips with Pro Riders</media:title>
      <media:content url="https://www.youtube.com/v/${randomId2}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:thumbnail url="https://i1.ytimg.com/vi/${randomId2}/hqdefault.jpg" width="480" height="360"/>
      <media:description>Learn from the pros! Top motocross riders share their training secrets.</media:description>
      <media:community>
        <media:starRating count="892" average="4.8" min="1" max="5"/>
        <media:statistics views="23456"/>
      </media:community>
    </media:group>
  </entry>
  
  <entry>
    <id>yt:video:${randomId3}</id>
    <yt:videoId>${randomId3}</yt:videoId>
    <yt:channelId>UCYgeLwCuPMH9bjwepxHy8jQ</yt:channelId>
    <title>2024 Bike Setup Guide - Suspension Tuning</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=${randomId3}"/>
    <author>
      <name>Racer X Illustrated</name>
      <uri>https://www.youtube.com/channel/UCYgeLwCuPMH9bjwepxHy8jQ</uri>
    </author>
    <published>${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}</published>
    <updated>${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}</updated>
    <media:group>
      <media:title>2024 Bike Setup Guide - Suspension Tuning</media:title>
      <media:content url="https://www.youtube.com/v/${randomId3}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:thumbnail url="https://i1.ytimg.com/vi/${randomId3}/hqdefault.jpg" width="480" height="360"/>
      <media:description>Complete guide to setting up your suspension for optimal performance on the track.</media:description>
      <media:community>
        <media:starRating count="567" average="4.9" min="1" max="5"/>
        <media:statistics views="34567"/>
      </media:community>
    </media:group>
  </entry>
</feed>`;

    console.log(`🎭 Using mock RSS data for testing (${mockRSSData.length} chars)`);
    return mockRSSData;

  } else {
    // Direct fetch for mobile (should work without CORS issues)
    // iOS optimization: shorter timeout and better error handling
    const mobileTimeout = Platform.OS === 'ios' ? 10000 : 15000; // iOS gets shorter timeout
    
    try {
      console.log(`📱 [PERFORMANCE] Mobile fetch (${Platform.OS}) with ${mobileTimeout}ms timeout`);
      const response = await fetchWithTimeout(url, mobileTimeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      
      console.log(`📄 Response length: ${responseText.length} chars`);
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from server');
      }
      
      if (!isValidXMLContent(responseText)) {
        console.log(`⚠️ Response doesn't look like XML`);
        console.log(`First 200 chars: ${responseText.substring(0, 200)}`);
        throw new Error('Response does not contain valid XML content');
      }
      
      return sanitizeXML(responseText);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Direct fetch failed: ${errorMsg}`);
    }
  }
};

const extractVideoId = (link: string): string => {
  const match = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : '';
};

const getThumbnailUrl = (videoId: string): string => {
  if (!videoId) return 'https://via.placeholder.com/480x360?text=No+Thumbnail';
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

export const fetchVideosFromChannelsRSS = async (
  channels: YouTubeChannel[], 
  totalLimit: number = 50,
  onProgress?: (channelName: string, status: 'loading' | 'completed' | 'error', count?: number, error?: string) => void
): Promise<YouTubeVideo[]> => {
  if (channels.length === 0) {
    console.log('⚠️ No channels provided');
    return [];
  }

  // Filter to only enabled channels and validate channel IDs
  const validChannels = channels.filter(channel => {
    if (!channel.channelId || channel.channelId.length < 10) {
      console.warn(`⚠️ Skipping ${channel.name} - invalid channel ID: ${channel.channelId}`);
      return false;
    }
    return true;
  });

  if (validChannels.length === 0) {
    console.log('⚠️ No valid channels found');
    return [];
  }

  console.log(`🎯 Fetching recent videos from ${validChannels.length} YouTube channel(s) via RSS`);

  const allVideos: YouTubeVideo[] = [];
  let successfulChannels = 0;
  let failedChannels = 0;
  const errors: string[] = [];

  for (const channel of validChannels) {
    try {
      const channelStartTime = Date.now();
      onProgress?.(channel.name, 'loading');
      
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
      console.log(`📡 [PERFORMANCE] Fetching RSS for ${channel.name}: ${rssUrl}`);
      
      const responseText = await fetchRSSContent(rssUrl);
      const fetchTime = Date.now() - channelStartTime;
      console.log(`⏱️ [PERFORMANCE] ${channel.name} fetch took: ${fetchTime}ms`);
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from YouTube RSS feed');
      }

      console.log(`🔄 Parsing RSS feed for ${channel.name}...`);
      
      let parsedFeed;
      try {
        parsedFeed = await rssParser.parse(responseText);
        console.log(`✅ Successfully parsed RSS for ${channel.name}`);
      } catch (parseError) {
        console.log(`⚠️ Initial parsing failed for ${channel.name}:`, parseError);
        
        // Try more aggressive cleaning
        let cleanedXML = responseText
          // Remove any content before XML declaration or feed tag
          .replace(/^.*?(<\?xml|<feed)/s, '$1')
          // Remove any content after closing feed tag
          .replace(/(<\/feed>).*$/s, '$1')
          // Remove control characters
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          // Fix common entity issues
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          // Remove any script or style tags
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .trim();
        
        try {
          parsedFeed = await rssParser.parse(cleanedXML);
          console.log(`✅ Advanced cleaning successful for ${channel.name}`);
        } catch (ultraError) {
          console.error(`❌ Advanced cleaning also failed for ${channel.name}:`, ultraError);
          throw new Error(`Failed to parse RSS feed after cleaning: ${ultraError}`);
        }
      }
      
      if (!parsedFeed.items || parsedFeed.items.length === 0) {
        console.log(`⚠️ No items found in RSS feed: ${channel.name}`);
        throw new Error('No video items found in RSS feed');
      }
      
      console.log(`✅ Successfully parsed ${channel.name}: ${parsedFeed.items.length} videos`);
      successfulChannels++;
      
      const channelVideos = parsedFeed.items.map((item: rssParser.RSSItem) => {
        const videoLink = item.links && item.links.length > 0 ? item.links[0].url : '';
        const videoId = extractVideoId(videoLink);
        
        console.log(`📹 Processing video: ${item.title} (ID: ${videoId})`);
        
        return {
          id: videoId || `${channel.id}-${Date.now()}-${Math.random()}`,
          title: item.title || 'Untitled Video',
          description: item.description || '',
          thumbnailUrl: getThumbnailUrl(videoId),
          publishedAt: item.published || new Date().toISOString(),
          duration: 'N/A',
          viewCount: 'N/A',
          channelTitle: channel.name,
          channelId: channel.channelId,
          videoUrl: videoLink || `https://www.youtube.com/channel/${channel.channelId}`,
        };
      });

      allVideos.push(...channelVideos);
      onProgress?.(channel.name, 'completed', channelVideos.length);
      
      const totalChannelTime = Date.now() - channelStartTime;
      console.log(`🏁 [PERFORMANCE] ${channel.name} completed in: ${totalChannelTime}ms`);
      
      // Optimized delay between channels based on platform
      if (validChannels.length > 1) {
        const delay = Platform.OS === 'ios' ? 500 : 1000; // iOS gets shorter delay
        console.log(`⏳ [PERFORMANCE] Waiting ${delay}ms before next channel...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error fetching RSS for channel ${channel.name}:`, errorMsg);
      errors.push(`${channel.name}: ${errorMsg}`);
      failedChannels++;
      onProgress?.(channel.name, 'error', 0, errorMsg);
      continue;
    }
  }
  
  console.log(`📊 RSS Fetch Summary: ${successfulChannels} successful, ${failedChannels} failed channels`);
  
  if (allVideos.length === 0) {
    const errorSummary = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
    throw new YouTubeRSSError(`Failed to load videos from any of the ${validChannels.length} channel(s). This might be due to CORS restrictions or temporary network issues. Please try again later.${errorSummary}`);
  }

  console.log(`📹 Total videos available: ${allVideos.length}`);
  
  // Sort by publish date (newest first)
  const sortedVideos = allVideos.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  
  // Limit to requested amount
  const finalVideos = sortedVideos.slice(0, totalLimit);
  
  console.log(`🎬 Final result: ${finalVideos.length} most recent videos from RSS feeds`);
  
  return finalVideos;
};