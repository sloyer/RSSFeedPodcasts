// api/notifications/race-preferences.js
// GET  ?token=ExponentPushToken[...]  → returns current race_preferences for that token
// PUT  { token, preferences: { supercross, mxgp, motocross, canadian } }
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const VALID_SERIES = ['supercross', 'mxgp', 'motocross', 'canadian'];

const DEFAULT_PREFS = {
  supercross: true,
  mxgp: true,
  motocross: true,
  canadian: true
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: 'token query param required' });
    }

    const { data, error } = await supabase
      .from('push_tokens')
      .select('race_preferences')
      .eq('expo_push_token', token)
      .single();

    if (error || !data) {
      // Token not found — return defaults so the app always gets something usable
      return res.status(200).json({ success: true, preferences: DEFAULT_PREFS });
    }

    return res.status(200).json({
      success: true,
      preferences: data.race_preferences || DEFAULT_PREFS
    });
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { token, preferences } = req.body || {};

    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ success: false, error: 'preferences object is required' });
    }

    // Only keep known series keys; default missing ones to true
    const sanitized = {};
    for (const series of VALID_SERIES) {
      sanitized[series] = preferences[series] !== undefined
        ? Boolean(preferences[series])
        : true;
    }

    const { error } = await supabase
      .from('push_tokens')
      .update({ race_preferences: sanitized })
      .eq('expo_push_token', token);

    if (error) {
      console.error('[RACE-PREFS] Update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to save preferences' });
    }

    console.log(`[RACE-PREFS] Updated for token ...${token.slice(-10)}:`, sanitized);
    return res.status(200).json({ success: true, preferences: sanitized });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
