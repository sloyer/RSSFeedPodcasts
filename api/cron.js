// api/cron.js - Enhanced with Push Notifications via RevenueCat
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

async function sendPushNotificationsViaRevenueCat(newContent) {
  if (!newContent || newContent.length === 0) return;
  
  console.log(`[PUSH] Processing ${newContent.length} items via RevenueCat`);

  // Get all subscribers from RevenueCat
  let allSubscribers = [];
  try {
    console.log('[PUSH] Fetching subscribers from RevenueCat...');
    const response = await fetch('https://api.revenuecat.com/v1/subscribers', {
      headers: {
        'Authorization': `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('[PUSH] RevenueCat API error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    allSubscribers = data.subscribers || [];
    console.log(`[PUSH] Found ${allSubscribers.length} total subscribers in RevenueCat`);
  } catch (error) {
    console.error('[PUSH] Error fetching subscribers from RevenueCat:', error);
    return;
  }

  // Process each new content item
  for (const item of newContent) {
    try {
      // Check if already sent (keep dedup in Supabase)
      const { data: alreadySent } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('content_id', item.id)
        .eq('feed_name', item.feedName)
        .single();

      if (alreadySent) {
        console.log(`[PUSH] Already sent for ${item.feedName}: ${item.title.substring(0, 50)}...`);
        continue;
      }

      console.log(`[PUSH] Finding subscribers for ${item.feedName}...`);

      const feedType = item.type === 'article' ? 'news' : 
                       item.type === 'video' ? 'youtube' : 'podcasts';
      
      const tokensToNotify = [];
      
      // Filter subscribers who want this specific feed
      for (const subscriber of allSubscribers) {
        try {
          const prefsAttr = subscriber.subscriber_attributes?.user_preferences;
          if (!prefsAttr || !prefsAttr.value) continue;
          
          const prefs = JSON.parse(prefsAttr.value);
          
          // Check if this user wants notifications for this feed
          const notifications = prefs.notifications?.[feedType] || [];
          const pushToken = prefs.pushToken;
          
          // Match by feed ID (notifications array contains feed IDs)
          if (notifications.includes(item.feedId) && pushToken) {
            tokensToNotify.push(pushToken);
          }
        } catch (parseError) {
          // Skip users with invalid preference data
          console.error('[PUSH] Error parsing subscriber preferences:', parseError);
        }
      }

      if (tokensToNotify.length === 0) {
        console.log(`[PUSH] No subscribers for ${item.feedName}`);
        continue;
      }

      console.log(`[PUSH] Sending to ${tokensToNotify.length} devices for ${item.feedName}`);

      // Build notification messages
      const messages = tokensToNotify.map(token => ({
        to: token,
        title: `New from ${item.feedName}`,
        body: item.title.substring(0, 150),
        data: {
          type: item.type,
          id: item.id,
          feedName: item.feedName,
          url: item.url || ''
        },
        sound: 'default',
        badge: 1,
        priority: 'high'
      }));

      // Send to Expo (batch up to 100 at a time)
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

      // Log that we sent this (keep dedup in Supabase)
      await supabase
        .from('sent_notifications')
        .insert({
          content_id: item.id,
          content_type: item.type,
          feed_name: item.feedName,
          title: item.title,
          recipient_count: tokensToNotify.length,
          sent_at: new Date().toISOString()
        });

      console.log(`[PUSH] ✅ Logged notification for ${item.feedName}`);

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
    const recentContent = []; // Collect content for notifications
    
    // STEP 1: Fetch podcasts
    try {
      const podcastResults = await fetchAndStoreFeeds();
      results.podcasts = 'success';
      console.log('✅ Podcasts completed');
      
      // Collect new episodes (adjust based on what fetchAndStoreFeeds() actually returns)
      if (podcastResults && podcastResults.newEpisodes) {
        podcastResults.newEpisodes
          .filter(e => isRecent(e.podcast_date || e.published_date))
          .forEach(e => {
            recentContent.push({
              id: String(e.id || e.guid),
              feedId: String(e.podcast_id || e.show_id || e.id), // Feed ID for matching
              title: e.podcast_title || e.title,
              feedName: e.show_name || e.podcast_name,
              type: 'podcast',
              url: e.feed_url || e.link
            });
          });
      }
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
      
      // Collect new articles
      if (articleResults && articleResults.newArticles) {
        articleResults.newArticles
          .filter(a => isRecent(a.published_date))
          .forEach(a => {
            recentContent.push({
              id: String(a.id),
              feedId: String(a.source_id || a.company_id || a.id), // Feed ID for matching
              title: a.title,
              feedName: a.company || a.source_name,
              type: 'article',
              url: a.article_url
            });
          });
      }
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
        
        // Collect new videos
        if (youtubeResults.newVideos) {
          youtubeResults.newVideos
            .filter(v => isRecent(v.publishedAt))
            .forEach(v => {
              recentContent.push({
                id: String(v.id),
                feedId: String(v.channelId || v.id), // Channel ID for matching
                title: v.title,
                feedName: v.channelName,
                type: 'video',
                url: v.watchUrl
              });
            });
        }
      } else {
        results.youtube = `error: ${youtubeResults.error}`;
        console.log('❌ YouTube failed:', youtubeResults.error);
      }
    } catch (error) {
      results.youtube = `error: ${error.message}`;
      console.log('❌ YouTube failed:', error.message);
    }
    
    // STEP 4: Send push notifications via RevenueCat
    if (recentContent.length > 0) {
      console.log(`[PUSH] Found ${recentContent.length} recent items, sending notifications...`);
      try {
        await sendPushNotificationsViaRevenueCat(recentContent);
        results.notifications = `processed ${recentContent.length} items`;
      } catch (error) {
        results.notifications = `error: ${error.message}`;
        console.log('❌ Notifications failed:', error.message);
      }
    } else {
      console.log('[PUSH] No recent content to notify about');
      results.notifications = 'no new content';
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

