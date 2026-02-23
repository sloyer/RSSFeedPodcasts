// api/notifications/mute.js
// Called by the mobile app when the user taps "Mute for 24 hours".
// Sets muted_until on the backend so ALL cron jobs (content, inactive reminder,
// race alerts) skip this user while the mute is active.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST to mute, DELETE to unmute early
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, hours } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (req.method === 'DELETE') {
      // Unmute early
      const { error } = await supabase
        .from('push_tokens')
        .update({ muted_until: null })
        .eq('user_id', userId);

      if (error) {
        console.error('[MUTE] Unmute error:', error);
        return res.status(500).json({ success: false, error: 'Failed to unmute' });
      }

      console.log(`[MUTE] Unmuted user ${userId}`);
      return res.status(200).json({ success: true, muted_until: null });
    }

    // Default mute duration is 24 hours; caller may override
    const muteDurationHours = typeof hours === 'number' && hours > 0 ? hours : 24;
    const mutedUntil = new Date();
    mutedUntil.setHours(mutedUntil.getHours() + muteDurationHours);

    const { error } = await supabase
      .from('push_tokens')
      .update({ muted_until: mutedUntil.toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[MUTE] Update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to set mute' });
    }

    console.log(`[MUTE] User ${userId} muted until ${mutedUntil.toISOString()}`);
    return res.status(200).json({ success: true, muted_until: mutedUntil.toISOString() });

  } catch (error) {
    console.error('[MUTE] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
