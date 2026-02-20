// api/cron.js - Complete with Push Notifications (FIXED - Using Subtitle!)

import { fetchAndStoreFeeds } from '../lib/fetchFeeds.js';
import { fetchMotocrossFeeds } from '../lib/fetchMotocrossFeeds.js';
import { fetchYouTubeVideos } from '../lib/fetchYouTubeVideos.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================================================
// PUSH NOTIFICATION HELPERS
// ============================================================================

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function isRecent(dateString) {
  const contentDate = new Date(dateString);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  return contentDate > thirtyMinutesAgo;
}

async function uploadImageToTwitter(imageUrl, oauth) {
  try {
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.log('[TWITTER] Failed to fetch image:', imageUrl);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Upload to Twitter media endpoint (v1.1)
    const crypto = await import('crypto');
    const uploadOauth = {
      ...oauth,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      nonce: crypto.randomBytes(32).toString('base64')
    };

    const method = 'POST';
    const url = 'https://upload.twitter.com/1.1/media/upload.json';
    const params = {
      oauth_consumer_key: uploadOauth.consumer_key,
      oauth_token: uploadOauth.token,
      oauth_signature_method: uploadOauth.signature_method,
      oauth_timestamp: uploadOauth.timestamp,
      oauth_nonce: uploadOauth.nonce,
      oauth_version: uploadOauth.version
    };

    const paramString = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(uploadOauth.consumer_secret)}&${encodeURIComponent(uploadOauth.token_secret)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    params.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
      .join(', ');

    // Upload image
    const uploadResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `media_data=${encodeURIComponent(base64Image)}`
    });

    if (uploadResponse.ok) {
      const data = await uploadResponse.json();
      console.log('[TWITTER] Image uploaded successfully, media_id:', data.media_id_string);
      return data.media_id_string;
    } else {
      const error = await uploadResponse.text();
      console.error('[TWITTER] Image upload failed:', error);
      return null;
    }
  } catch (error) {
    console.error('[TWITTER] Error uploading image:', error);
    return null;
  }
}

async function postToTwitter(item) {
  try {
    // Skip if no Twitter credentials configured
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || 
        !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
      console.log('[TWITTER] Skipping - credentials not configured');
      return;
    }

    // Check if we already tweeted this (independent of push notifications)
    const { data: alreadyTweeted } = await supabase
      .from('sent_tweets')
      .select('id')
      .eq('content_id', item.id)
      .eq('feed_name', item.feedName)
      .single();

    if (alreadyTweeted) {
      console.log(`[TWITTER] Already tweeted: ${item.title.substring(0, 40)}...`);
      return;
    }

    // Build deep link using Universal Links (works on all platforms)
    const deepLink = `https://www.motoaggregate.app/a/${item.id}`;
    
    // Emoji for content type
    const emoji = item.type === 'article' ? '📰' :
                  item.type === 'video' ? '🎥' : '🎙️';
    
    // Build tweet (280 char limit)
    const tweetText = `${emoji} ${item.feedName}: ${item.title}

${deepLink}

#Motocross #Supercross`;

    // Truncate if too long
    const finalTweet = tweetText.length > 280 
      ? tweetText.substring(0, 277) + '...' 
      : tweetText;

    console.log(`[TWITTER] Posting tweet for: ${item.title.substring(0, 40)}...`);

    // Generate OAuth 1.0a signature
    const crypto = await import('crypto');
    const oauth = {
      consumer_key: process.env.TWITTER_API_KEY,
      consumer_secret: process.env.TWITTER_API_SECRET,
      token: process.env.TWITTER_ACCESS_TOKEN,
      token_secret: process.env.TWITTER_ACCESS_SECRET,
      signature_method: 'HMAC-SHA1',
      timestamp: Math.floor(Date.now() / 1000).toString(),
      nonce: crypto.randomBytes(32).toString('base64'),
      version: '1.0'
    };

    // Upload image if available
    let mediaId = null;
    if (item.image) {
      console.log('[TWITTER] Uploading image:', item.image);
      mediaId = await uploadImageToTwitter(item.image, oauth);
    } else {
      console.log('[TWITTER] No image available for this item');
    }

    // Build OAuth signature
    const method = 'POST';
    const url = 'https://api.twitter.com/2/tweets';
    const params = {
      oauth_consumer_key: oauth.consumer_key,
      oauth_token: oauth.token,
      oauth_signature_method: oauth.signature_method,
      oauth_timestamp: oauth.timestamp,
      oauth_nonce: oauth.nonce,
      oauth_version: oauth.version
    };

    const paramString = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(oauth.consumer_secret)}&${encodeURIComponent(oauth.token_secret)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    params.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
      .join(', ');

    // Build tweet body with optional media
    const tweetBody = {
      text: finalTweet
    };

    if (mediaId) {
      tweetBody.media = {
        media_ids: [mediaId]
      };
    }

    // Post to Twitter API v2
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetBody)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[TWITTER] ✅ Tweet posted: https://twitter.com/i/web/status/${data.data.id}`);
      
      // Track that we tweeted this (independent of push notifications)
      await supabase
        .from('sent_tweets')
        .insert({
          content_id: item.id,
          content_type: item.type,
          feed_name: item.feedName,
          title: item.title,
          tweet_id: data.data.id,
          tweeted_at: new Date().toISOString()
        });
    } else {
      const error = await response.text();
      console.error('[TWITTER] Failed to post:', error);
    }

  } catch (error) {
    console.error('[TWITTER] Error:', error);
    // Don't throw - continue even if Twitter fails
  }
}

async function sendPushNotifications(newContent) {
  if (!newContent || newContent.length === 0) return;
  
  console.log(`[PUSH] Processing ${newContent.length} items`);

  // Track if we've tweeted in this run (only tweet once per cron run = ~every 15 min)
  let hasPostedToTwitter = false;

  for (const item of newContent) {
    try {
      // Check if already sent
      const { data: alreadySent } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('content_id', item.id)
        .eq('feed_name', item.feedName)
        .single();

      if (alreadySent) {
        console.log(`[PUSH] Already sent for ${item.id}`);
        continue;
      }

      // Find subscribers to this feed
      const feedType = item.type === 'article' ? 'news' : 
                       item.type === 'video' ? 'youtube' : 'podcasts';

      // Primary: match by feed_id (stable, won't break if names change)
      let { data: preferences } = await supabase
        .from('notification_preferences')
        .select('user_id')
        .eq('feed_id', item.feedId)
        .eq('feed_type', feedType)
        .eq('notifications_enabled', true);

      let matchedBy = 'feed_id';

      // Fallback: match by feed_name for legacy rows that may not have correct feed_id
      if ((!preferences || preferences.length === 0) && item.feedName) {
        const fallback = await supabase
          .from('notification_preferences')
          .select('user_id')
          .eq('feed_name', item.feedName)
          .eq('feed_type', feedType)
          .eq('notifications_enabled', true);
        preferences = fallback.data;
        matchedBy = 'feed_name';
      }

      if (!preferences || preferences.length === 0) {
        console.log(`[PUSH] No subscribers for ${item.feedName} (feedId: ${item.feedId})`);
        continue;
      }

      console.log(`[PUSH] Found ${preferences.length} subscribers for ${item.feedName} (matched by ${matchedBy})`);

      // Get push tokens
      const userIds = preferences.map(p => p.user_id);
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (!tokens || tokens.length === 0) {
        console.log(`[PUSH] No active tokens`);
        continue;
      }

      console.log(`[PUSH] Sending to ${tokens.length} devices`);

      // Build messages with SUBTITLE for better visibility
      const messages = tokens.map(t => {
        // Remove "The " from company name
        let cleanCompany = item.feedName.replace(/^The\s+/i, '');
        
        // Shorten company to 15 chars (more room now)
        const shortCompany = cleanCompany.length > 15 
          ? cleanCompany.substring(0, 15)
          : cleanCompany;
        
        // Content type (short label)
        const contentType = item.type === 'article' ? 'Article' :
                            item.type === 'video' ? 'Video' :
                            'Podcast';
        
        // TITLE: Type first, then source (line 1 - always visible)
        // Format: "Article: Racer X" or "Video: MXGP" or "Podcast: PulpMX Show"
        const title = `${contentType}: ${shortCompany}`;
        
        // SUBTITLE: The actual content title (line 2 - visible in collapsed view!)
        // iOS shows ~70 chars in subtitle on notification center
        const subtitle = item.title.length > 70
          ? item.title.substring(0, 67) + '...'
          : item.title;
        
        return {
          to: t.expo_push_token,
          title: title,           // Line 1: "Article: Racer X"
          subtitle: subtitle,     // Line 2: iOS only - shows in collapsed view
          body: subtitle,         // Android uses body instead of subtitle
          data: {
            type: item.type,
            id: item.id,
            feedName: item.feedName,
            url: item.url,
            title: item.title
          },
          sound: 'default',
          badge: 1,
          priority: 'high',
          channelId: 'default',   // Android notification channel
          _displayInForeground: true
        };
      });

      // Send to Expo (batch up to 100)
      const chunks = chunkArray(messages, 100);
      
      for (const chunk of chunks) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk)
        });

        if (!response.ok) {
          console.error('[PUSH] Expo error:', await response.text());
        } else {
          console.log(`[PUSH] ✅ Sent ${chunk.length} notifications`);
        }
      }

      // Log as sent (upsert to handle race conditions - if already exists, skip)
      await supabase
        .from('sent_notifications')
        .upsert({
          content_id: item.id,
          content_type: item.type,
          feed_name: item.feedName,
          title: item.title,
          recipient_count: tokens.length,
          sent_at: new Date().toISOString()
        }, {
          onConflict: 'content_id,feed_name',
          ignoreDuplicates: true
        });

      // NEW: Tweet ONLY THE FIRST (newest) item per cron run
      if (!hasPostedToTwitter) {
        await postToTwitter(item);
        hasPostedToTwitter = true;
        console.log('[TWITTER] Posted newest item, skipping rest to avoid spam');
      } else {
        console.log(`[TWITTER] Skipping "${item.title.substring(0, 40)}..." (rate limited)`);
      }

    } catch (error) {
      console.error(`[PUSH] Error for ${item.feedName}:`, error);
    }
  }
}

// ============================================================================
// FEED ID LOOKUP — maps content feed names to stable database IDs
// ============================================================================

async function loadFeedIdMaps() {
  const maps = { podcasts: {}, news: {}, youtube: {} };

  try {
    const [rssResult, motoResult, ytResult] = await Promise.all([
      supabase.from('rss_feeds').select('id, feed_name').eq('is_active', true),
      supabase.from('motocross_feeds').select('id, company_name').eq('is_active', true),
      supabase.from('youtube_channels').select('id, channel_id, channel_title, display_name').eq('is_active', true),
    ]);

    if (rssResult.data) {
      for (const f of rssResult.data) {
        maps.podcasts[f.feed_name] = f.id.toString();
      }
    }

    if (motoResult.data) {
      for (const f of motoResult.data) {
        maps.news[f.company_name] = f.id.toString();
      }
    }

    if (ytResult.data) {
      for (const f of ytResult.data) {
        maps.youtube[f.channel_title] = f.id.toString();
        if (f.display_name) maps.youtube[f.display_name] = f.id.toString();
      }
    }

    console.log(`[PUSH] Feed ID maps loaded — podcasts: ${Object.keys(maps.podcasts).length}, news: ${Object.keys(maps.news).length}, youtube: ${Object.keys(maps.youtube).length}`);
  } catch (error) {
    console.error('[PUSH] Error loading feed ID maps:', error);
  }

  return maps;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const startTime = Date.now();
    console.log('🔄 Cron job started');
    
    const results = {};
    
    // STEP 1: Fetch podcasts
    try {
      await fetchAndStoreFeeds();
      results.podcasts = 'success';
      console.log('✅ Podcasts completed');
    } catch (error) {
      results.podcasts = `error: ${error.message}`;
      console.log('❌ Podcasts failed:', error.message);
    }
    
    // STEP 2: Fetch articles
    try {
      let dateParam = req.query.date || false;
      
      if (req.query.days) {
        dateParam = `days:${req.query.days}`;
        console.log(`📰 Fetching ${req.query.days} days of articles...`);
      } else if (dateParam) {
        console.log(`🎯 Test mode: fetching articles for ${dateParam}`);
      } else {
        console.log('🔄 Normal mode: fetching recent articles');
      }
      
      const articleResults = await fetchMotocrossFeeds(dateParam);
      results.articles = `success: ${articleResults.articlesProcessed} articles, ${articleResults.feedsSkipped} feeds skipped`;
      console.log('✅ Articles completed');
    } catch (error) {
      results.articles = `error: ${error.message}`;
      console.log('❌ Articles failed:', error.message);
    }
    
    // STEP 3: Fetch YouTube videos
    try {
      console.log('📺 Starting YouTube video fetch...');
      
      const youtubeDays = req.query.days ? parseInt(req.query.days) : 2;
      const youtubeResults = await fetchYouTubeVideos(youtubeDays);
      
      if (youtubeResults.success) {
        results.youtube = `success: ${youtubeResults.videosAdded} videos from ${youtubeResults.channelsProcessed} channels`;
        console.log('✅ YouTube completed');
      } else {
        results.youtube = `error: ${youtubeResults.error}`;
        console.log('❌ YouTube failed:', youtubeResults.error);
      }
    } catch (error) {
      results.youtube = `error: ${error.message}`;
      console.log('❌ YouTube failed:', error.message);
    }
    
    // STEP 4: Check for recent content and send push notifications
    // Note: Twitter now has its own dedicated cron (/api/cron-twitter) running every 10 min
    try {
      console.log('[PUSH] Checking for recent content to notify about...');
      
      const feedIdMaps = await loadFeedIdMaps();
      const recentContent = [];
      const API_BASE_URL = 'https://rss-feed-podcasts.vercel.app';
      
      // Query recent podcasts
      try {
        const response = await fetch(`${API_BASE_URL}/api/podcasts?limit=50`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const recentEpisodes = data.data.filter(item => isRecent(item.podcast_date));
          
          console.log(`[PUSH] Found ${recentEpisodes.length} recent podcast episodes`);
          
          recentEpisodes.forEach(e => {
            const feedName = e.show_name || e.podcast_name;
            recentContent.push({
              id: String(e.id || e.guid),
              feedId: feedIdMaps.podcasts[feedName] || String(e.id),
              title: e.podcast_title || e.title,
              feedName,
              type: 'podcast',
              url: e.feed_url || e.link,
              image: e.podcast_image || e.image_url
            });
          });
        }
      } catch (error) {
        console.error('[PUSH] Error fetching recent podcasts:', error);
      }
      
      // Query recent articles
      try {
        const response = await fetch(`${API_BASE_URL}/api/articles?limit=50`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const recentArticles = data.data.filter(item => isRecent(item.published_date));
          
          console.log(`[PUSH] Found ${recentArticles.length} recent articles`);
          
          recentArticles.forEach(a => {
            recentContent.push({
              id: String(a.id),
              feedId: feedIdMaps.news[a.company] || String(a.id),
              title: a.title,
              feedName: a.company,
              type: 'article',
              url: a.article_url,
              image: a.image_url
            });
          });
        }
      } catch (error) {
        console.error('[PUSH] Error fetching recent articles:', error);
      }
      
      // Query recent videos
      try {
        const response = await fetch(`${API_BASE_URL}/api/youtube?limit=50&days=1`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const recentVideos = data.data.filter(item => isRecent(item.publishedAt));
          
          console.log(`[PUSH] Found ${recentVideos.length} recent videos`);
          
          recentVideos.forEach(v => {
            recentContent.push({
              id: String(v.id),
              feedId: feedIdMaps.youtube[v.channelName] || String(v.id),
              title: v.title,
              feedName: v.channelName,
              type: 'video',
              url: v.watchUrl,
              image: v.thumbnailUrl
            });
          });
        }
      } catch (error) {
        console.error('[PUSH] Error fetching recent videos:', error);
      }
      
      // Send notifications
      if (recentContent.length > 0) {
        console.log(`[PUSH] Sending notifications for ${recentContent.length} items...`);
        
        // Sort by priority for Twitter: Podcasts > Videos > Articles
        const sortedContent = [...recentContent].sort((a, b) => {
          const priority = { podcast: 1, video: 2, article: 3 };
          const aPriority = priority[a.type] || 999;
          const bPriority = priority[b.type] || 999;
          
          // If same type, sort by newest
          if (aPriority === bPriority) {
            return String(b.id).localeCompare(String(a.id));
          }
          
          return aPriority - bPriority; // Lower number = higher priority
        });
        
        await sendPushNotifications(sortedContent);
        results.notifications = `sent for ${recentContent.length} items`;
      } else {
        console.log('[PUSH] No recent content found');
        results.notifications = 'no new content';
      }
      
    } catch (error) {
      results.notifications = `error: ${error.message}`;
      console.log('❌ Notifications step failed:', error.message);
    }
    
    const duration = (Date.now() - startTime) / 1000;
    
    res.status(200).json({ 
      message: `Cron completed in ${duration}s`,
      results: results,
      timestamp: new Date().toISOString(),
      mode: req.query.date ? `test (${req.query.date})` : req.query.days ? `bulk (${req.query.days} days)` : 'normal'
    });
    
  } catch (error) {
    console.error('💥 Cron error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch feeds',
      message: error.message
    });
  }
}

