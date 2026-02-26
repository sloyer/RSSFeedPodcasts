// Shared handler for all schedule series endpoints
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function seriesHandler(series, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Return only upcoming events — disappear the day after they end
    const { data: events, error } = await supabase
      .from('schedules')
      .select('id, series, round, name, location, start_date, end_date, start_time_akst')
      .eq('series', series)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
      .order('start_date', { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      series,
      data: events || [],
      count: (events || []).length,
      asOf: today
    });

  } catch (error) {
    console.error(`[SCHEDULES/${series.toUpperCase()}] Error:`, error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
