// api/cron-race-notifications.js - Race Day Push Notifications
// Sends TWO notifications per race:
// 1. At coverage start (10 AM local) - "Live timing is starting"
// 2. 10 minutes before main events - "Main events starting soon"
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Format series name for display
function formatSeriesName(series) {
  switch (series) {
    case 'supercross': return 'Supercross';
    case 'motocross': return 'Pro Motocross';
    case 'smx': return 'SMX Playoffs';
    default: return series;
  }
}

// Send notification to all active users
async function sendRaceNotification(notificationId, title, subtitle, body, eventData) {
  // Check if we already sent this notification
  const { data: alreadySent } = await supabase
    .from('sent_notifications')
    .select('id')
    .eq('content_id', notificationId)
    .eq('feed_name', 'race_alert')
    .single();
  
  if (alreadySent) {
    console.log(`[RACE] Already sent: ${notificationId}`);
    return 0;
  }
  
  // Get all active push tokens (race notifications go to everyone)
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('is_active', true);
  
  if (tokenError) throw tokenError;
  
  if (!tokens || tokens.length === 0) {
    console.log('[RACE] No active push tokens');
    return 0;
  }
  
  console.log(`[RACE] Sending "${title}" to ${tokens.length} devices`);
  
  const messages = tokens.map(t => ({
    to: t.expo_push_token,
    title: title,
    subtitle: subtitle,  // iOS only
    body: body,
    data: eventData,
    sound: 'default',
    badge: 1,
    priority: 'high',
    channelId: 'race_alerts',
    _displayInForeground: true
  }));
  
  // Send to Expo in batches
  const chunks = chunkArray(messages, 100);
  let sentCount = 0;
  
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
      console.error('[RACE] Expo error:', await response.text());
    } else {
      console.log(`[RACE] Sent ${chunk.length} notifications`);
      sentCount += chunk.length;
    }
  }
  
  // Log as sent
  await supabase
    .from('sent_notifications')
    .upsert({
      content_id: notificationId,
      content_type: 'race_alert',
      feed_name: 'race_alert',
      title: title,
      recipient_count: tokens.length,
      sent_at: new Date().toISOString()
    }, {
      onConflict: 'content_id,feed_name',
      ignoreDuplicates: true
    });
  
  return sentCount;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const startTime = Date.now();
    const now = new Date();
    console.log(`[RACE] Notification cron started at ${now.toISOString()}`);
    
    let totalNotificationsSent = 0;
    
    // ===================================================================
    // CHECK 1: Morning coverage start (10 AM local) - notify 5 min before
    // ===================================================================
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    const { data: coverageEvents, error: coverageError } = await supabase
      .from('race_events')
      .select('*')
      .gte('coverage_start_utc', fiveMinutesAgo.toISOString())
      .lte('coverage_start_utc', fiveMinutesFromNow.toISOString())
      .eq('is_tbd', false);
    
    if (coverageError) throw coverageError;
    
    console.log(`[RACE] Found ${coverageEvents?.length || 0} races with coverage starting`);
    
    for (const event of (coverageEvents || [])) {
      try {
        const seriesName = formatSeriesName(event.series);
        const location = event.state ? `${event.city}, ${event.state}` : event.city;
        
        const notificationId = `race-coverage-${event.id}`;
        const title = `${seriesName} Round ${event.round}`;
        const subtitle = location;  // iOS only
        const body = `Live timing is starting - ${event.venue}`;
        
        const sent = await sendRaceNotification(notificationId, title, subtitle, body, {
          type: 'race_coverage_start',
          eventId: event.id,
          round: event.round,
          series: event.series,
          venue: event.venue,
          coverageStartUTC: event.coverage_start_utc,
          gateDropUTC: event.gate_drop_utc
        });
        
        totalNotificationsSent += sent;
        if (sent > 0) {
          console.log(`[RACE] Coverage start notification sent for Round ${event.round}`);
        }
      } catch (error) {
        console.error(`[RACE] Error for coverage event ${event.id}:`, error);
      }
    }
    
    // ===================================================================
    // CHECK 2: Main events (gate drop) - notify 10 min before
    // ===================================================================
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
    
    // Window: 10-15 minutes before gate drop (so cron hits it once at ~10min mark)
    const { data: mainEvents, error: mainError } = await supabase
      .from('race_events')
      .select('*')
      .gte('gate_drop_utc', tenMinutesFromNow.toISOString())
      .lte('gate_drop_utc', fifteenMinutesFromNow.toISOString())
      .eq('is_tbd', false);
    
    if (mainError) throw mainError;
    
    console.log(`[RACE] Found ${mainEvents?.length || 0} races with mains starting in ~10 min`);
    
    for (const event of (mainEvents || [])) {
      try {
        const seriesName = formatSeriesName(event.series);
        const location = event.state ? `${event.city}, ${event.state}` : event.city;
        
        const notificationId = `race-mains-${event.id}`;
        const title = `${seriesName} Round ${event.round}`;
        const subtitle = location;  // iOS only
        const body = `Main events starting soon - ${event.venue}`;
        
        const sent = await sendRaceNotification(notificationId, title, subtitle, body, {
          type: 'race_mains_start',
          eventId: event.id,
          round: event.round,
          series: event.series,
          venue: event.venue,
          gateDropUTC: event.gate_drop_utc
        });
        
        totalNotificationsSent += sent;
        if (sent > 0) {
          console.log(`[RACE] Main events notification sent for Round ${event.round}`);
        }
      } catch (error) {
        console.error(`[RACE] Error for main event ${event.id}:`, error);
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    const coverageCount = coverageEvents?.length || 0;
    const mainsCount = mainEvents?.length || 0;
    
    return res.status(200).json({
      success: true,
      message: `Race notification cron completed in ${duration}s`,
      coverageEventsChecked: coverageCount,
      mainEventsChecked: mainsCount,
      notificationsSent: totalNotificationsSent,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('[RACE] Notification cron error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
