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
    // Get all active RSS feeds (configured shows)
    const { data: rssFeeds, error: feedsError } = await supabase
      .from('rss_feeds')
      .select('feed_name, display_name, description, image_url')
      .eq('is_active', true)
      .order('feed_name');
    
    if (feedsError) throw feedsError;
    
    // Get all podcasts for episode counting
    const { data: podcasts, error: podcastsError } = await supabase
      .from('podcasts')
      .select('podcast_name, podcast_date, podcast_image')
      .not('podcast_name', 'is', null)
      .order('podcast_date', { ascending: false });
    
    if (podcastsError) throw podcastsError;
    
    // Create episode counts map
    const episodeCounts = {};
    const latestDates = {};
    const showImages = {};
    
    podcasts.forEach(episode => {
      const showName = episode.podcast_name;
      episodeCounts[showName] = (episodeCounts[showName] || 0) + 1;
      
      // Update latest episode date
      const episodeDate = new Date(episode.podcast_date);
      if (!latestDates[showName] || episodeDate > new Date(latestDates[showName])) {
        latestDates[showName] = episode.podcast_date;
        showImages[showName] = episode.podcast_image;
      }
    });
    
    // Build shows array from RSS feeds (include all configured feeds)
    const shows = rssFeeds.map(feed => {
      const showName = feed.display_name || feed.feed_name;
      const episodeCount = episodeCounts[showName] || 0;
      
      return {
        show_name: showName,
        episode_count: episodeCount,
        latest_episode_date: latestDates[showName] || null,
        show_image: showImages[showName] || feed.image_url || null,
        endpoint_url: `/api/podcasts?podcast_name=${encodeURIComponent(showName)}`,
        description: feed.description || null,
        has_episodes: episodeCount > 0
      };
    });
    
    // Sort by: shows with episodes first (by latest date), then shows without episodes
    shows.sort((a, b) => {
      // Shows with episodes come first
      if (a.has_episodes && !b.has_episodes) return -1;
      if (!a.has_episodes && b.has_episodes) return 1;
      
      // Both have episodes: sort by latest date
      if (a.has_episodes && b.has_episodes) {
        if (!a.latest_episode_date) return 1;
        if (!b.latest_episode_date) return -1;
        return new Date(b.latest_episode_date) - new Date(a.latest_episode_date);
      }
      
      // Both have no episodes: sort alphabetically
      return a.show_name.localeCompare(b.show_name);
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
