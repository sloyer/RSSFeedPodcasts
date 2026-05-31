// GET /api/mxgp/race?event_id=4108&race_id=351&class=mxgp&year=2026
import { createClient } from '@supabase/supabase-js';
import { applyCors, normalizeClass } from '../../lib/mxgpScraper.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { event_id, race_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });
  if (!race_id)  return res.status(400).json({ error: 'race_id is required' });

  const year       = String(req.query.year || new Date().getFullYear());
  const cls        = normalizeClass(req.query.class);
  const resultType = req.query.result_type || '1';
  const key        = `mxgp:race:${event_id}:${race_id}:${cls}:${year}:rt${resultType}`;

  const { data, error } = await supabase
    .from('mxgp_cache')
    .select('data, fetched_at')
    .eq('key', key)
    .single();

  if (error || !data) return res.status(404).json({ error: 'No data yet — cron has not run', key });
  return res.status(200).json({ ...data.data, fetched_at: data.fetched_at });
}
