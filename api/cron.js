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

// Returns true if the current time is between 1 AM and 7 AM Alaska Standard Time (UTC-9)
function isAlaskaQuietHours() {
  const alaskaHour = (new Date().getUTCHours() - 9 + 24) % 24;
  return alaskaHour >= 1 && alaskaHour < 7;
}

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


// ============================================================================
// FACEBOOK PAGE POSTING
// ============================================================================

async function postToFacebook(item) {
  try {
    if (!process.env.FACEBOOK_PAGE_ID || !process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      console.log('[FACEBOOK] Skipping - credentials not configured');
      return;
    }

    // Dedup: skip if we already posted this item
    const { data: alreadyPosted } = await supabase
      .from('sent_fb_posts')
      .select('id')
      .eq('content_id', item.id)
      .eq('feed_name', item.feedName)
      .single();

    if (alreadyPosted) {
      console.log(`[FACEBOOK] Already posted: ${item.title.substring(0, 40)}...`);
      return;
    }

    // Description snippet (keep it short)
    const rawDesc = item.description || '';
    const desc = rawDesc.length > 200
      ? rawDesc.substring(0, 197).trimEnd() + '...'
      : rawDesc.trim();

    // Credit line
    const credit = `Via: ${item.feedName}`;

    // Build message: title, optional description, credit
    const parts = [item.title];
    if (desc) parts.push(desc);
    parts.push(credit);
    const message = parts.join('\n\n');

    // URL — Facebook will auto-scrape og:image for the thumbnail preview card
    const link = item.url || `https://www.motoaggregate.app/a/${item.id}`;

    console.log(`[FACEBOOK] Posting for: ${item.title.substring(0, 50)}...`);

    const body = {
      message,
      link,
      access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.FACEBOOK_PAGE_ID}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (res.ok) {
      const data = await res.json();
      console.log(`[FACEBOOK] ✅ Posted: https://www.facebook.com/${data.id}`);

      // Track so we never post the same item twice
      await supabase.from('sent_fb_posts').insert({
        content_id: item.id,
        content_type: item.type,
        feed_name: item.feedName,
        title: item.title,
        fb_post_id: data.id,
        posted_at: new Date().toISOString()
      });
    } else {
      const err = await res.text();
      console.error(`[FACEBOOK] ❌ Failed (${res.status}): ${err.substring(0, 200)}`);
    }

  } catch (error) {
    console.error('[FACEBOOK] Error:', error);
    // Don't throw - continue even if Facebook fails
  }
}

async function sendPushNotifications(newContent) {
  if (!newContent || newContent.length === 0) return;
  
  console.log(`[PUSH] Processing ${newContent.length} items`);

  let hasPostedToFacebook = false;

  // ── Facebook runs FIRST, independently of push subscribers ──
  for (const item of newContent) {
    if (!hasPostedToFacebook) {
      await postToFacebook(item);
      hasPostedToFacebook = true;
      break;
    }
  }

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

      // Get push tokens, excluding muted users so "Mute for 24h" is respected
      // for content notifications as well.
      const userIds = preferences.map(p => p.user_id);
      const now = new Date().toISOString();
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', userIds)
        .eq('is_active', true)
        .or(`muted_until.is.null,muted_until.lt.${now}`);

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

      // Facebook is handled in the pre-loop above (independent of subscribers)

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
              image: e.podcast_image || e.image_url,
              description: e.podcast_description || ''
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
              image: a.image_url,
              description: a.excerpt || '',
              author: a.author || ''
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
              image: v.thumbnailUrl,
              description: v.description || ''
            });
          });
        }
      } catch (error) {
        console.error('[PUSH] Error fetching recent videos:', error);
      }
      
      // Send notifications
      if (isAlaskaQuietHours()) {
        console.log('[PUSH] Quiet hours (1–7 AM AKST) — skipping push notifications');
        results.notifications = 'skipped (quiet hours 1–7 AM AKST)';
      } else if (recentContent.length > 0) {
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

