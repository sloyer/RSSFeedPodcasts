// api/podcasts/shows.js - Clean Show Discovery API
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
    // Get podcast show descriptions from rss_feeds
    const { data: feedDescriptions } = await supabase
      .from('rss_feeds')
      .select('feed_name, description')
      .eq('is_active', true);
    
    const descriptionMap = new Map();
    feedDescriptions?.forEach(feed => {
      descriptionMap.set(feed.feed_name, feed.description);
    });
    
    // SIMPLE APPROACH: Use podcast_name from podcasts table as source of truth
    const { data: podcasts, error } = await supabase
      .from('podcasts')
      .select('podcast_name, podcast_date, podcast_image')
      .not('podcast_name', 'is', null)
      .order('podcast_date', { ascending: false });
    
    if (error) throw error;
    
    // Group by podcast_name (the ONLY field that matters)
    const showsMap = {};
    
    podcasts.forEach(episode => {
      const showName = episode.podcast_name; // THIS IS THE STANDARD FIELD
      
      if (!showsMap[showName]) {
        showsMap[showName] = {
          show_name: showName,
          episode_count: 0,
          latest_episode_date: null,
          show_image: episode.podcast_image,
          endpoint_url: `/api/podcasts?podcast_name=${encodeURIComponent(showName)}`,
          description: descriptionMap.get(showName) || null,
          has_episodes: true
        };
      }
      
      showsMap[showName].episode_count++;
      
      // Update latest episode date
      const episodeDate = new Date(episode.podcast_date);
      if (!showsMap[showName].latest_episode_date || 
          episodeDate > new Date(showsMap[showName].latest_episode_date)) {
        showsMap[showName].latest_episode_date = episode.podcast_date;
      }
    });
    
    // Convert to array and sort by latest episode date
    const shows = Object.values(showsMap).sort((a, b) => {
      if (!a.latest_episode_date) return 1;
      if (!b.latest_episode_date) return -1;
      return new Date(b.latest_episode_date) - new Date(a.latest_episode_date);
    });
    
    return res.status(200).json({
      success: true,
      data: shows,
      total_shows: shows.length
    });
    
  } catch (error) {
    console.error('Shows API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
