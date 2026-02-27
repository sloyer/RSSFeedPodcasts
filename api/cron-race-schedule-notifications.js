// api/cron-race-schedule-notifications.js
// Runs every 15 minutes. Sends a push notification to opted-in users when a
// scheduled race event starts within the next 60–75 minutes.
//
// Series preference mapping (matches app's race_preferences keys):
//   supercross → schedules.series IN ('supercross', 'smx')
//   mxgp       → schedules.series = 'mxgp'
//   motocross  → schedules.series = 'promx'
//   canadian   → schedules.series = 'canadian'
//
// Deduplication: uses sent_notifications table with content_id = 'race_reminder_<id>'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Map schedule series → race_preferences key
function prefKeyForSeries(series) {
  if (series === 'supercross' || series === 'smx') return 'supercross';
  if (series === 'mxgp') return 'mxgp';
  if (series === 'promx') return 'motocross';
  if (series === 'canadian') return 'canadian';
  return null;
}

function seriesDisplayName(series) {
  switch (series) {
    case 'supercross': return 'AMA Supercross';
    case 'smx':        return 'SMX World Championship';
    case 'mxgp':       return 'MXGP';
    case 'promx':      return 'AMA Pro Motocross';
    case 'canadian':   return 'Canadian Triple Crown';
    default:           return series;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    // Window: events starting between 55 and 75 minutes from now
    // (centres on 65 min; wide enough to never be missed by a 15-min cron)
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 75 * 60 * 1000);

    // Find schedule events starting in the window
    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('schedules')
      .select('id, series, round, name, location, start_datetime_utc')
      .gte('start_datetime_utc', windowStart.toISOString())
      .lte('start_datetime_utc', windowEnd.toISOString());

    if (eventsError) throw eventsError;

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return res.status(200).json({ success: true, message: 'No events in window', sent: 0 });
    }

    console.log(`[RACE-SCHED] Found ${upcomingEvents.length} event(s) in 60-75 min window`);

    let totalSent = 0;

    for (const event of upcomingEvents) {
      const notifId = `race_reminder_${event.id}`;

      // Deduplication — skip if already sent
      const { data: alreadySent } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('content_id', notifId)
        .eq('feed_name', 'race_schedule_reminder')
        .single();

      if (alreadySent) {
        console.log(`[RACE-SCHED] Already sent for ${event.name} (${event.id})`);
        continue;
      }

      const prefKey = prefKeyForSeries(event.series);
      if (!prefKey) {
        console.warn(`[RACE-SCHED] Unknown series: ${event.series}`);
        continue;
      }

      // Get tokens where the user has opted in to this series
      // race_preferences->>'supercross' = 'true' etc.
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .eq('is_active', true)
        .eq('notifications_globally_enabled', true)
        .or(`muted_until.is.null,muted_until.lt.${now.toISOString()}`)
        .eq(`race_preferences->>${prefKey}`, 'true');

      if (tokenError) {
        console.error(`[RACE-SCHED] Token fetch error for ${event.name}:`, tokenError);
        continue;
      }

      if (!tokens || tokens.length === 0) {
        console.log(`[RACE-SCHED] No opted-in tokens for ${event.name}`);
        // Still mark as sent so we don't check again next cycle
        await supabase.from('sent_notifications').insert({
          content_id: notifId,
          feed_name: 'race_schedule_reminder',
          content_type: 'race_reminder',
          title: event.name,
          recipient_count: 0,
          sent_at: now.toISOString()
        });
        continue;
      }

      const displayName = seriesDisplayName(event.series);
      const roundLabel  = event.round.match(/^\d+$/) ? `Round ${event.round}` : event.round;
      const title = `🏁 ${displayName}`;
      const body  = `${roundLabel}: ${event.name} starts in about 1 hour!`;

      const messages = tokens.map(t => ({
        to: t.expo_push_token,
        title,
        body,
        data: {
          type: 'race',
          series: prefKey,
          scheduleId: event.id
        },
        sound: 'default',
        badge: 1,
        priority: 'high',
        channelId: 'race_alerts',
        _displayInForeground: true
      }));

      // Send in batches of 100
      let sent = 0;
      for (const chunk of chunkArray(messages, 100)) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk)
        });
        if (response.ok) {
          sent += chunk.length;
        } else {
          console.error('[RACE-SCHED] Expo error:', await response.text());
        }
      }

      // Mark as sent
      await supabase.from('sent_notifications').insert({
        content_id: notifId,
        feed_name: 'race_schedule_reminder',
        content_type: 'race_reminder',
        title: event.name,
        recipient_count: sent,
        sent_at: now.toISOString()
      });

      console.log(`[RACE-SCHED] ✅ Sent "${body}" to ${sent} devices`);
      totalSent += sent;
    }

    return res.status(200).json({ success: true, sent: totalSent });

  } catch (error) {
    console.error('[RACE-SCHED] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
