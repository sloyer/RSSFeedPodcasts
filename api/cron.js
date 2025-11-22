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

async function sendPushNotifications(newContent) {
  if (!newContent || newContent.length === 0) return;
  
  console.log(`[PUSH] Processing ${newContent.length} items`);

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

      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('user_id')
        .eq('feed_name', item.feedName)
        .eq('feed_type', feedType)
        .eq('notifications_enabled', true);

      if (!preferences || preferences.length === 0) {
        console.log(`[PUSH] No subscribers for ${item.feedName}`);
        continue;
      }

      console.log(`[PUSH] Found ${preferences.length} subscribers for ${item.feedName}`);

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
          title: title,           // Line 1: "Racer X Article"
          subtitle: subtitle,     // Line 2: "Jett Lawrence Dominates 2025 Supercross..." (iOS only)
          body: '',              // Empty - who cares about expanded view
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
          channelId: 'default'  // Android notification channel
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

      // Log as sent
      await supabase
        .from('sent_notifications')
        .insert({
          content_id: item.id,
          content_type: item.type,
          feed_name: item.feedName,
          title: item.title,
          recipient_count: tokens.length,
          sent_at: new Date().toISOString()
        });

    } catch (error) {
      console.error(`[PUSH] Error for ${item.feedName}:`, error);
    }
  }
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
    try {
      console.log('[PUSH] Checking for recent content to notify about...');
      
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
            recentContent.push({
              id: String(e.id || e.guid),
              feedId: String(e.id),
              title: e.podcast_title || e.title,
              feedName: e.show_name || e.podcast_name,
              type: 'podcast',
              url: e.feed_url || e.link
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
              feedId: String(a.id),
              title: a.title,
              feedName: a.company,
              type: 'article',
              url: a.article_url
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
              feedId: String(v.id),
              title: v.title,
              feedName: v.channelName,
              type: 'video',
              url: v.watchUrl
            });
          });
        }
      } catch (error) {
        console.error('[PUSH] Error fetching recent videos:', error);
      }
      
      // Send notifications
      if (recentContent.length > 0) {
        console.log(`[PUSH] Sending notifications for ${recentContent.length} items...`);
        await sendPushNotifications(recentContent);
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

