// api/videos.js - Video Channels Discovery API (similar to podcasts/shows)
import { supabase } from '../../../lib/supabaseClient.js';

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
    // Get all channels with their video stats in a single optimized query
    const { data: channelStats, error } = await supabase
      .from('youtube_channels')
      .select(`
        channel_id,
        channel_title,
        display_name,
        is_active,
        youtube_videos!inner (
          video_id,
          published_at,
          thumbnail_url
        )
      `)
      .eq('is_active', true)
      .order('youtube_videos.published_at', { ascending: false });
    
    if (error) throw error;
    
    // Process the data to group by channel and get stats
    const channelMap = new Map();
    
    channelStats.forEach(row => {
      const channelName = row.display_name || row.channel_title;
      const channelId = row.channel_id;
      
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, {
          channel_name: channelName,
          channel_id: channelId,
          video_count: 0,
          latest_video_date: null,
          channel_image: null,
          endpoint_url: `/api/youtube?channel_id=${encodeURIComponent(channelName.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
          description: `Videos from ${channelName}`,
          has_videos: false
        });
      }
      
      const channel = channelMap.get(channelId);
      channel.video_count++;
      channel.has_videos = true;
      
      // Update latest video info if this is newer
      if (!channel.latest_video_date || 
          new Date(row.youtube_videos.published_at) > new Date(channel.latest_video_date)) {
        channel.latest_video_date = row.youtube_videos.published_at;
        channel.channel_image = row.youtube_videos.thumbnail_url;
      }
    });
    
    // Convert to array
    const channelData = Array.from(channelMap.values());
    
    // Sort by latest video date (newest first), then by video count
    channelData.sort((a, b) => {
      if (!a.latest_video_date && !b.latest_video_date) {
        return b.video_count - a.video_count;
      }
      if (!a.latest_video_date) return 1;
      if (!b.latest_video_date) return -1;
      return new Date(b.latest_video_date) - new Date(a.latest_video_date);
    });
    
    return res.status(200).json({
      success: true,
      data: channelData,
      total_channels: channelData.length
    });
    
  } catch (error) {
    console.error('Videos API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
