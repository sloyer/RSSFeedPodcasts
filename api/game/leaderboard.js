// api/game/leaderboard.js - Fetch leaderboards
import { supabase } from '../../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { trackId, type, period } = req.query;

    // Validate required params
    if (trackId === undefined || !type || !period) {
      return res.status(400).json({
        error: 'trackId, type, and period are required'
      });
    }

    const trackIdNum = parseInt(trackId, 10);
    if (isNaN(trackIdNum)) {
      return res.status(400).json({ error: 'trackId must be a number' });
    }

    if (!['race', 'lap'].includes(type)) {
      return res.status(400).json({ error: 'type must be "race" or "lap"' });
    }

    if (!['weekly', 'alltime'].includes(period)) {
      return res.status(400).json({ error: 'period must be "weekly" or "alltime"' });
    }

    // Determine which column to sort by
    const timeColumn = type === 'race' ? 'race_time_ms' : 'best_lap_ms';

    // Build query
    let query = supabase
      .from('game_scores')
      .select(`
        player_name,
        ${timeColumn},
        user_id
      `)
      .eq('track_id', trackIdNum)
      .not(timeColumn, 'is', null)
      .order(timeColumn, { ascending: true });

    // Apply time filter for weekly
    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('completed_at', weekAgo.toISOString());
    }

    const { data: scores, error: scoresError } = await query;

    if (scoresError) {
      throw scoresError;
    }

    // Get banned users to filter out
    const { data: bannedUsers } = await supabase
      .from('game_players')
      .select('user_id')
      .eq('banned', true);

    const bannedIds = new Set((bannedUsers || []).map(u => u.user_id));

    // Filter out banned users and get best time per player (dedupe)
    const playerBests = new Map();
    
    for (const score of scores) {
      if (bannedIds.has(score.user_id)) continue;
      
      const time = score[timeColumn];
      const name = score.player_name;
      
      if (!playerBests.has(name) || time < playerBests.get(name)) {
        playerBests.set(name, time);
      }
    }

    // Convert to array, sort, and take top 5
    const leaderboard = Array.from(playerBests.entries())
      .map(([name, ms]) => ({ name, ms }))
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 5);

    return res.status(200).json(leaderboard);

  } catch (error) {
    console.error('Game leaderboard API error:', error);
    return res.status(500).json({
      error: error.message || 'Server error'
    });
  }
}
