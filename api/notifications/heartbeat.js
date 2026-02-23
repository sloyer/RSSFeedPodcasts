// api/notifications/heartbeat.js
// Called by the mobile app every time it comes to the foreground (AppState 'active').
// Keeps last_active fresh so cron-inactive-reminder.js doesn't treat active users
// as inactive and send them "Miss us?" notifications.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const { error } = await supabase
      .from('push_tokens')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[HEARTBEAT] Update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update last_active' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[HEARTBEAT] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
