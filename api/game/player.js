// api/game/player.js - Player name registration and lookup
import { supabase } from '../../lib/supabaseClient.js';

// Profanity filter - server-side validation
const BLOCKED_WORDS = [
  'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'nigger', 'nigga', 'faggot', 
  'fag', 'retard', 'whore', 'slut', 'cock', 'dick', 'pussy', 'penis',
  'vagina', 'bastard', 'damn', 'piss', 'twat', 'wanker', 'douche'
];

function normalize(str) {
  return str.toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/\s/g, '');
}

function isProfane(name) {
  const cleaned = normalize(name);
  return BLOCKED_WORDS.some(word => cleaned.includes(word));
}

function isValidFormat(name) {
  return /^[a-zA-Z0-9 _\-\.]{2,16}$/.test(name);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET /api/game/player?userId=abc123
    if (req.method === 'GET') {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const { data, error } = await supabase
        .from('game_players')
        .select('player_name')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return res.status(200).json({
        playerName: data?.player_name || null
      });
    }

    // POST /api/game/player
    if (req.method === 'POST') {
      const { userId, playerName } = req.body;

      if (!userId || !playerName) {
        return res.status(400).json({
          success: false,
          error: 'userId and playerName are required'
        });
      }

      // Validate format
      if (!isValidFormat(playerName)) {
        return res.status(400).json({
          success: false,
          error: 'Name must be 2-16 characters, alphanumeric with _ - . only'
        });
      }

      // Check profanity
      if (isProfane(playerName)) {
        return res.status(400).json({
          success: false,
          error: 'Name not allowed'
        });
      }

      // Check if name already taken by someone else
      const { data: existingName } = await supabase
        .from('game_players')
        .select('user_id')
        .eq('player_name', playerName)
        .single();

      if (existingName && existingName.user_id !== userId) {
        return res.status(400).json({
          success: false,
          error: 'Name already taken'
        });
      }

      // Upsert player (insert or update if user already has a name)
      const { error: upsertError } = await supabase
        .from('game_players')
        .upsert({
          user_id: userId,
          player_name: playerName
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        if (upsertError.code === '23505') {
          return res.status(400).json({
            success: false,
            error: 'Name already taken'
          });
        }
        throw upsertError;
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Game player API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
