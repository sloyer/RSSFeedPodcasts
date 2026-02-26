// api/schedules.js
// Returns upcoming schedule events for AMA Supercross and MXGP.
// Events are automatically excluded the day after they end — no manual cleanup needed.
// Query params:
//   ?series=supercross   filter to one series
//   ?series=mxgp
//   (omit for all series)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { series } = req.query;

    // today's date as YYYY-MM-DD in UTC (Vercel runs UTC)
    const today = new Date().toISOString().split('T')[0];

    // Only return events that haven't finished yet:
    // - Single-day events (end_date IS NULL): keep while start_date >= today
    // - Multi-day events: keep while end_date >= today
    // Using .or() to handle both cases
    let query = supabase
      .from('schedules')
      .select('id, series, name, location, start_date, end_date, start_time_akst')
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
      .order('start_date', { ascending: true });

    if (series) {
      query = query.eq('series', series);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    // Group by series for easy consumption by the app
    const supercross = (events || []).filter(e => e.series === 'supercross');
    const mxgp = (events || []).filter(e => e.series === 'mxgp');

    return res.status(200).json({
      success: true,
      data: {
        supercross,
        mxgp,
        all: events || []
      },
      count: (events || []).length,
      asOf: today
    });

  } catch (error) {
    console.error('[SCHEDULES] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
