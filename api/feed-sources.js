// api/feed-sources.js - Dynamic Feed Discovery API
import { supabase } from '../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { type } = req.query;
      
      const feedSources = {};
      
      // Fetch news feeds (articles) - use company_name from motocross_feeds table  
      if (!type || type === 'news') {
        const { data: newsFeeds, error: newsError } = await supabase
          .from('motocross_feeds')
          .select('id, feed_name, company_name')
          .eq('is_active', true)
          .not('company_name', 'is', null)
          .order('company_name', { ascending: true });
        
        if (newsError) throw newsError;
        
        feedSources.news = newsFeeds.map(feed => ({
          id: feed.id.toString(),
          name: feed.company_name, // Use company_name which matches articles table
          apiCode: feed.company_name.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          logo: `https://via.placeholder.com/100x100/FF5722/FFFFFF?text=${encodeURIComponent(feed.company_name.charAt(0))}`,
          category: 'Motocross News',
          enabled: false, // Default - user will set this
          type: 'news',
          priority: 1
        }));
      }
      
      // Fetch podcast feeds - get actual podcast names from podcasts table
      if (!type || type === 'podcasts') {
        const { data: podcastNames, error: podcastError } = await supabase
          .from('podcasts')
          .select('podcast_name')
          .not('podcast_name', 'is', null)
          .order('podcast_name', { ascending: true });
        
        if (podcastError) throw podcastError;
        
        // Get unique podcast names
        const uniquePodcastNames = [...new Set(podcastNames.map(item => item.podcast_name))];
        
        feedSources.podcasts = uniquePodcastNames.map((podcastName, index) => {
          const apiCode = podcastName.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return {
            id: (index + 1).toString(),
            name: podcastName,
            apiCode: apiCode,
            url: `https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=${apiCode}`,
            logo: `https://via.placeholder.com/100x100/9C27B0/FFFFFF?text=${encodeURIComponent(podcastName.charAt(0))}`,
            category: 'Podcasts',
            enabled: false, // Default - user will set this
            type: 'podcasts',
            priority: 1
          };
        });
      }
      
      // Fetch YouTube channels - using existing fields only
      if (!type || type === 'youtube') {
        const { data: youtubeFeeds, error: youtubeError } = await supabase
          .from('youtube_channels')
          .select('*')
          .eq('is_active', true)
          .order('channel_title', { ascending: true });
        
        if (youtubeError) throw youtubeError;
        
        feedSources.youtube = youtubeFeeds.map(feed => {
          const apiCode = (feed.display_name || feed.channel_title).toUpperCase().replace(/[^A-Z0-9]/g, '');
          return {
            id: feed.id.toString(),
            name: feed.display_name || feed.channel_title,
            apiCode: apiCode,
            logo: `https://via.placeholder.com/100x100/F44336/FFFFFF?text=${encodeURIComponent((feed.display_name || feed.channel_title).charAt(0))}`,
            category: 'YouTube',
            enabled: false, // Default - user will set this
            type: 'youtube',
            priority: 1
          };
        });
      }
      
      // Return single type or all types
      if (type) {
        return res.status(200).json({
          success: true,
          data: feedSources[type] || [],
          type
        });
      } else {
        return res.status(200).json({
          success: true,
          data: feedSources,
          types: ['news', 'podcasts', 'youtube']
        });
      }
      
    } catch (error) {
      console.error('Feed sources API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Server error'
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
