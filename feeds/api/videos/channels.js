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
    // Get all active channels first
    const { data: channels, error: channelsError } = await supabase
      .from('youtube_channels')
      .select('channel_id, channel_title, display_name')
      .eq('is_active', true);
    
    if (channelsError) throw channelsError;
    
    // Get all videos with channel info in one query
    const { data: videos, error: videosError } = await supabase
      .from('youtube_videos')
      .select('channel_id, published_at, thumbnail_url')
      .in('channel_id', channels.map(c => c.channel_id))
      .order('published_at', { ascending: false });
    
    if (videosError) throw videosError;
    
    // Process the data to group by channel and get stats
    const channelMap = new Map();
    
    // Initialize all channels
    channels.forEach(channel => {
      const channelName = channel.display_name || channel.channel_title;
      channelMap.set(channel.channel_id, {
        channel_name: channelName,
        channel_id: channel.channel_id,
        video_count: 0,
        latest_video_date: null,
        channel_image: null,
        endpoint_url: `/api/youtube?channel_id=${encodeURIComponent(channelName.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
        description: `Videos from ${channelName}`,
        has_videos: false
      });
    });
    
    // Process videos to add stats
    videos.forEach(video => {
      const channel = channelMap.get(video.channel_id);
      if (channel) {
        channel.video_count++;
        channel.has_videos = true;
        
        // Update latest video info if this is newer
        if (!channel.latest_video_date || 
            new Date(video.published_at) > new Date(channel.latest_video_date)) {
          channel.latest_video_date = video.published_at;
          channel.channel_image = video.thumbnail_url;
        }
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
