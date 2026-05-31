// GET /api/mxgp/sessions?year=2026&event=mxgp-of-france&class=mx1
// Class overall results for an event (rider position + moto1/moto2 scores).
// Populated by api/cron-mxgp.js — reads from Supabase mxgp_cache.

import { createClient } from '@supabase/supabase-js';
import { applyCors, normalizeClass } from '../../lib/mxgpScraper.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { event } = req.query;
  if (!event) return res.status(400).json({ error: 'event slug is required (e.g. mxgp-of-france)' });

  const year = String(req.query.year || new Date().getFullYear());
  const cls  = normalizeClass(req.query.class);
  const key  = `rx:overall:${year}:${event}:${cls}`;

  const { data, error } = await supabase
    .from('mxgp_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .single();

  if (error || !data) return res.status(404).json({ error: 'No data yet — cron has not run', key });
  return res.status(200).json({ ...data.data, fetched_at: data.fetched_at });
}
