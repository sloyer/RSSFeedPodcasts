// GET /api/mxgp/race?year=2026&event=mxgp-of-france&class=mx1&session=grand-prix-race-1
// Individual session results (pos, rider, time, gap, bike).
// Session slugs: grand-prix-race-1, grand-prix-race-2, qualifying-race, race-1, race-2
// Populated by api/cron-mxgp.js — reads from Supabase mxgp_cache.

import { createClient } from '@supabase/supabase-js';
import { applyCors, normalizeClass } from '../../lib/mxgpScraper.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { event, session } = req.query;
  if (!event)   return res.status(400).json({ error: 'event slug is required (e.g. mxgp-of-france)' });
  if (!session) return res.status(400).json({ error: 'session slug is required (e.g. grand-prix-race-1)' });

  const year = String(req.query.year || new Date().getFullYear());
  const cls  = normalizeClass(req.query.class);
  const key  = `rx:session:${year}:${event}:${cls}:${session}`;

  const { data, error } = await supabase
    .from('mxgp_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .single();

  if (error || !data) return res.status(404).json({ error: 'No data yet — cron has not run', key });
  return res.status(200).json({ ...data.data, fetched_at: data.fetched_at });
}
