// api/youtube.js - API endpoint for YouTube videos
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
      const { 
        limit = 20, 
        offset = 0, 
        search, 
        channel_id,
        channels, // comma-separated channel IDs for user preferences
        days = 7 // default to last 7 days
      } = req.query;

      // Start with base query
      let query = supabase
        .from('youtube_videos')
        .select('*')
        .order('published_at', { ascending: false });

      // Filter by date range (default last 7 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      query = query.gte('published_at', cutoffDate.toISOString());

      // Database-driven channel filtering
      if (channel_id) {
        // Look up the channel in youtube_channels table by display name or channel_id
        const { data: channelInfo, error: channelError } = await supabase
          .from('youtube_channels')
          .select('channel_id')
          .or(`display_name.ilike.%${channel_id}%,channel_id.eq.${channel_id}`)
          .eq('is_active', true)
          .single();
        
        if (channelError || !channelInfo) {
          // Fallback: try direct channel_id match
          query = query.eq('channel_id', channel_id);
        } else {
          // Use the actual channel_id from the database
          query = query.eq('channel_id', channelInfo.channel_id);
        }
      }

      // Filter by multiple channels (for user preferences)
      if (channels) {
        const channelList = channels.split(',');
        query = query.in('channel_id', channelList);
      }

      // Search in title and description
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Only get embeddable videos
      query = query.eq('embeddable', true);

      // Apply pagination
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data: videos, error, count } = await query;
      
      if (error) throw error;

      // Transform data for mobile app
      const transformedVideos = videos.map(video => ({
        id: video.video_id,
        channelId: video.channel_id,
        channelName: video.channel_title,
        title: video.title,
        description: video.description,
        publishedAt: video.published_at,
        thumbnailUrl: video.thumbnail_url,
        duration: video.duration,
        embedUrl: `https://www.youtube.com/embed/${video.video_id}`,
        watchUrl: `https://www.youtube.com/watch?v=${video.video_id}`,
        embedHtml: video.embed_html
      }));

      return res.status(200).json({ 
        success: true, 
        data: transformedVideos,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: videos.length
        }
      });
      
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
