// api/cron-mute-reminder.js - Send mute reminder on Fridays before race weekends
// Runs Friday 12:00 UTC (3AM AKST) when mute banner shows
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

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const now = new Date();
    console.log(`[MUTE REMINDER] Cron started at ${now.toISOString()}`);
    
    // Check if there's a race this weekend (Saturday)
    // Get tomorrow (Saturday) and check for events
    const saturday = new Date(now);
    saturday.setUTCDate(saturday.getUTCDate() + 1); // Friday -> Saturday
    saturday.setUTCHours(0, 0, 0, 0);
    
    const sunday = new Date(saturday);
    sunday.setUTCDate(sunday.getUTCDate() + 1);
    sunday.setUTCHours(23, 59, 59, 999);
    
    const { data: weekendRaces, error: raceError } = await supabase
      .from('race_events')
      .select('*')
      .gte('coverage_start_utc', saturday.toISOString())
      .lte('coverage_start_utc', sunday.toISOString())
      .eq('is_tbd', false);
    
    if (raceError) throw raceError;
    
    if (!weekendRaces || weekendRaces.length === 0) {
      console.log('[MUTE REMINDER] No races this weekend, skipping notification');
      return res.status(200).json({
        success: true,
        message: 'No races this weekend',
        sent: 0
      });
    }
    
    const race = weekendRaces[0];
    const seriesName = race.series === 'supercross' ? 'Supercross' : 
                       race.series === 'motocross' ? 'Pro Motocross' : 'SMX';
    
    console.log(`[MUTE REMINDER] Race this weekend: ${seriesName} Round ${race.round} at ${race.venue}`);
    
    // Check if we already sent this reminder
    const notificationId = `mute-reminder-${race.id}`;
    
    const { data: alreadySent } = await supabase
      .from('sent_notifications')
      .select('id')
      .eq('content_id', notificationId)
      .eq('feed_name', 'mute_reminder')
      .single();
    
    if (alreadySent) {
      console.log('[MUTE REMINDER] Already sent for this race');
      return res.status(200).json({
        success: true,
        message: 'Already sent mute reminder for this race',
        sent: 0
      });
    }
    
    // Get all active push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('is_active', true);
    
    if (tokenError) throw tokenError;
    
    if (!tokens || tokens.length === 0) {
      console.log('[MUTE REMINDER] No active push tokens');
      return res.status(200).json({
        success: true,
        message: 'No active push tokens',
        sent: 0
      });
    }
    
    console.log(`[MUTE REMINDER] Sending to ${tokens.length} devices`);
    
    // Build messages - opens Settings tab when tapped
    const messages = tokens.map(t => ({
      to: t.expo_push_token,
      title: `${seriesName} Round ${race.round} Tomorrow`,
      body: 'Tap to mute notifications and avoid spoilers',
      data: {
        type: 'navigate',
        route: '/(tabs)/settings'
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'default',
      _displayInForeground: true
    }));
    
    // Send in chunks of 100
    const chunks = chunkArray(messages, 100);
    let totalSent = 0;
    
    for (const chunk of chunks) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(chunk)
      });
      
      if (response.ok) {
        totalSent += chunk.length;
      } else {
        console.error('[MUTE REMINDER] Expo error:', await response.text());
      }
    }
    
    // Log as sent
    await supabase
      .from('sent_notifications')
      .upsert({
        content_id: notificationId,
        content_type: 'mute_reminder',
        feed_name: 'mute_reminder',
        title: `${seriesName} Round ${race.round} - Mute Reminder`,
        recipient_count: totalSent,
        sent_at: new Date().toISOString()
      }, {
        onConflict: 'content_id,feed_name',
        ignoreDuplicates: true
      });
    
    console.log(`[MUTE REMINDER] Sent to ${totalSent} devices`);
    
    return res.status(200).json({
      success: true,
      message: `Mute reminder sent to ${totalSent} devices`,
      race: `${seriesName} Round ${race.round}`,
      sent: totalSent
    });
    
  } catch (error) {
    console.error('[MUTE REMINDER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

