// api/cron-mute-reminder.js - Send mute reminders before race weekends
// Runs: Friday 12:00 UTC AND Saturday 14:00 UTC (early morning before coverage)
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
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
    
    console.log(`[MUTE REMINDER] Cron started at ${now.toISOString()} (day: ${dayOfWeek})`);
    
    // Determine if this is Friday or Saturday run
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    
    if (!isFriday && !isSaturday) {
      console.log('[MUTE REMINDER] Not Friday or Saturday, skipping');
      return res.status(200).json({ success: true, message: 'Not a reminder day', sent: 0 });
    }
    
    // Find race: on Friday look for Saturday, on Saturday look for today
    const raceDay = new Date(now);
    if (isFriday) {
      raceDay.setUTCDate(raceDay.getUTCDate() + 1); // Friday -> Saturday
    }
    raceDay.setUTCHours(0, 0, 0, 0);
    
    const raceDayEnd = new Date(raceDay);
    raceDayEnd.setUTCHours(23, 59, 59, 999);
    
    const { data: races, error: raceError } = await supabase
      .from('race_events')
      .select('*')
      .gte('coverage_start_utc', raceDay.toISOString())
      .lte('coverage_start_utc', raceDayEnd.toISOString())
      .eq('is_tbd', false);
    
    if (raceError) throw raceError;
    
    if (!races || races.length === 0) {
      console.log('[MUTE REMINDER] No race found, skipping');
      return res.status(200).json({ success: true, message: 'No race today/tomorrow', sent: 0 });
    }
    
    const race = races[0];
    const seriesName = race.series === 'supercross' ? 'Supercross' : 
                       race.series === 'motocross' ? 'Pro Motocross' : 'SMX';
    
    // Different notification ID and message for each day
    const reminderType = isFriday ? 'friday' : 'saturday';
    const notificationId = `mute-${reminderType}-${race.id}`;
    
    console.log(`[MUTE REMINDER] ${reminderType} reminder for ${seriesName} Round ${race.round}`);
    
    // Check if already sent
    const { data: alreadySent } = await supabase
      .from('sent_notifications')
      .select('id')
      .eq('content_id', notificationId)
      .eq('feed_name', 'mute_reminder')
      .single();
    
    if (alreadySent) {
      console.log(`[MUTE REMINDER] Already sent ${reminderType} reminder`);
      return res.status(200).json({ success: true, message: 'Already sent', sent: 0 });
    }
    
    // Get all active push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('is_active', true);
    
    if (tokenError) throw tokenError;
    
    if (!tokens || tokens.length === 0) {
      console.log('[MUTE REMINDER] No active push tokens');
      return res.status(200).json({ success: true, message: 'No tokens', sent: 0 });
    }
    
    // Build message based on day
    const title = isFriday 
      ? `${seriesName} Round ${race.round} Tomorrow`
      : `${seriesName} Round ${race.round} Today`;
    
    const body = 'Tap to mute notifications and avoid spoilers';
    
    console.log(`[MUTE REMINDER] Sending "${title}" to ${tokens.length} devices`);
    
    const messages = tokens.map(t => ({
      to: t.expo_push_token,
      title: title,
      body: body,
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
    
    // Send in chunks
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
        title: title,
        recipient_count: totalSent,
        sent_at: new Date().toISOString()
      }, {
        onConflict: 'content_id,feed_name',
        ignoreDuplicates: true
      });
    
    console.log(`[MUTE REMINDER] Sent ${reminderType} reminder to ${totalSent} devices`);
    
    return res.status(200).json({
      success: true,
      message: `${reminderType} mute reminder sent`,
      race: `${seriesName} Round ${race.round}`,
      sent: totalSent
    });
    
  } catch (error) {
    console.error('[MUTE REMINDER] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
