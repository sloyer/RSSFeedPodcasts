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
          .select('id, feed_name, company_name, feed_url, logo_url')
          .eq('is_active', true)
          .not('company_name', 'is', null)
          .order('company_name', { ascending: true });
        
        if (newsError) throw newsError;
        
        feedSources.news = newsFeeds.map(feed => {
          const domain = (() => {
            try { return new URL(feed.feed_url).hostname.replace(/^(www\.|feeds\.|rss\.|news\.)/, ''); }
            catch { return null; }
          })();
          const logo = feed.logo_url
            || (domain ? `https://logo.clearbit.com/${domain}` : null)
            || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          return {
            id: feed.id.toString(),
            name: feed.company_name,
            apiCode: feed.company_name.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            logo,
            category: 'Motocross News',
            enabled: false,
            type: 'news',
            priority: 1
          };
        });
      }
      
      // Fetch podcast feeds - get RSS feeds from rss_feeds table
      if (!type || type === 'podcasts') {
        const { data: podcastFeeds, error: podcastError } = await supabase
          .from('rss_feeds')
          .select('*')
          .eq('is_active', true)
          .order('feed_name', { ascending: true });
        
        if (podcastError) throw podcastError;
        
        feedSources.podcasts = podcastFeeds.map(feed => {
          const apiCode = feed.feed_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return {
            id: feed.id.toString(),
            name: feed.feed_name,
            apiCode: apiCode,
            url: `https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=${apiCode}`,
            logo: feed.image_url || null,
            category: 'Podcasts',
            enabled: false,
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
            logo: feed.thumbnail_url || null,
            category: 'YouTube',
            enabled: false,
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
