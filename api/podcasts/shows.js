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
    // Get podcast show descriptions from rss_feeds using feed_url as the join key
    const { data: feedDescriptions } = await supabase
      .from('rss_feeds')
      .select('id, feed_url, feed_name, display_name, description, created_at')
      .eq('is_active', true);
    
    // Create maps by feed_url (the reliable join key)
    const feedMetaByUrl = new Map();
    const feedMetaByName = new Map();
    
    feedDescriptions?.forEach(feed => {
      const meta = { id: feed.id, description: feed.description, created_at: feed.created_at };
      feedMetaByUrl.set(feed.feed_url, meta);
      feedMetaByName.set(feed.feed_name, meta);
      if (feed.display_name) feedMetaByName.set(feed.display_name, meta);
    });
    
    // SIMPLE APPROACH: Use podcast_name from podcasts table as source of truth
    const { data: podcasts, error } = await supabase
      .from('podcasts')
      .select('podcast_name, podcast_date, podcast_image, feed_url')
      .not('podcast_name', 'is', null)
      .order('podcast_date', { ascending: false });
    
    if (error) throw error;
    
    // Group by podcast_name (the ONLY field that matters)
    const showsMap = {};
    
    podcasts.forEach(episode => {
      const showName = episode.podcast_name; // THIS IS THE STANDARD FIELD
      
      if (!showsMap[showName]) {
        const meta = feedMetaByUrl.get(episode.feed_url) || feedMetaByName.get(showName) || {};
        
        // Check if show is new (added in last 45 days)
        const createdDate = new Date(meta.created_at || 0);
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        const is_new = createdDate > fortyFiveDaysAgo;
        
        showsMap[showName] = {
          id: meta.id ? meta.id.toString() : null,
          show_name: showName,
          episode_count: 0,
          latest_episode_date: null,
          show_image: episode.podcast_image,
          endpoint_url: `/api/podcasts?podcast_name=${encodeURIComponent(showName)}`,
          description: meta.description || null,
          has_episodes: true,
          is_new: is_new
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
