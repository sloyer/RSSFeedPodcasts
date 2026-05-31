// GET /api/mxgp/events?year=2026&class=mxgp
import { createClient } from '@supabase/supabase-js';
import { applyCors, normalizeClass } from '../../lib/mxgpScraper.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const year = String(req.query.year || new Date().getFullYear());
  const cls  = normalizeClass(req.query.class);
  const key  = `mxgp:events:${year}:${cls}`;

  const { data, error } = await supabase
    .from('mxgp_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .single();

  if (error || !data) return res.status(404).json({ error: 'No data yet — cron has not run', key });
  return res.status(200).json({ ...data.data, fetched_at: data.fetched_at });
}
