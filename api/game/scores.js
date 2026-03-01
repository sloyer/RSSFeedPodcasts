// api/game/scores.js - Submit race scores
import { supabase } from '../../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      userId,
      playerName,
      trackId,
      raceTimeMs,
      bestLapMs,
      finishPosition,
      completedAt
    } = req.body;

    // Validate required fields
    if (!userId || !playerName || trackId === undefined || !raceTimeMs) {
      return res.status(400).json({
        success: false,
        error: 'userId, playerName, trackId, and raceTimeMs are required'
      });
    }

    // Validate types
    if (typeof trackId !== 'number' || typeof raceTimeMs !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'trackId and raceTimeMs must be numbers'
      });
    }

    // Sanity checks
    if (raceTimeMs < 10000 || raceTimeMs > 3600000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid race time'
      });
    }

    if (bestLapMs && (bestLapMs < 5000 || bestLapMs > 600000)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lap time'
      });
    }

    // Insert score
    const { error: insertError } = await supabase
      .from('game_scores')
      .insert({
        user_id: userId,
        player_name: playerName,
        track_id: trackId,
        race_time_ms: raceTimeMs,
        best_lap_ms: bestLapMs || null,
        finish_pos: finishPosition || null,
        completed_at: completedAt || new Date().toISOString()
      });

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Game scores API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
