// api/podcasts/search.js - Fast podcast search using Supabase text search
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q, limit = 50 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query must be at least 2 characters' 
      });
    }

    const searchQuery = q.trim();
    const searchLimit = Math.min(parseInt(limit), 100); // Cap at 100

    // Use ilike for simple, fast matching
    // Searches across title, description, and podcast_name
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .or(`podcast_title.ilike.%${searchQuery}%,podcast_description.ilike.%${searchQuery}%,podcast_name.ilike.%${searchQuery}%`)
      .order('podcast_date', { ascending: false })
      .limit(searchLimit);

    if (error) throw error;

    // Map to expected format
    const results = data.map(ep => ({
      id: ep.id,
      podcast_title: ep.podcast_title,
      podcast_description: ep.podcast_description,
      podcast_date: ep.podcast_date,
      show_name: ep.podcast_name,
      audio_url: ep.audio_url,
      podcast_image: ep.podcast_image,
      feed_url: ep.feed_url,
      guid: ep.guid
    }));

    return res.status(200).json({
      success: true,
      data: results,
      query: searchQuery,
      count: results.length
    });

  } catch (error) {
    console.error('[PODCAST-SEARCH] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

