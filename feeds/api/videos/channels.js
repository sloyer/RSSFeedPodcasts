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
    // Get all active YouTube channels
    const { data: channels, error: channelsError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('is_active', true)
      .order('channel_title', { ascending: true });
    
    if (channelsError) throw channelsError;
    
    // Get video counts for each channel
    const channelData = [];
    
    for (const channel of channels) {
      // Get video count and latest video for this channel
      const { data: videos, error: videoError } = await supabase
        .from('youtube_videos')
        .select('video_id, published_at, thumbnail_url')
        .eq('channel_id', channel.channel_id)
        .order('published_at', { ascending: false })
        .limit(1);
      
      if (videoError) {
        console.warn(`Error fetching videos for channel ${channel.channel_id}:`, videoError);
        continue;
      }
      
      // Get total video count for this channel
      const { count: videoCount, error: countError } = await supabase
        .from('youtube_videos')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.channel_id);
      
      if (countError) {
        console.warn(`Error counting videos for channel ${channel.channel_id}:`, countError);
      }
      
      const channelName = channel.display_name || channel.channel_title;
      
      channelData.push({
        channel_name: channelName,
        channel_id: channel.channel_id,
        video_count: videoCount || 0,
        latest_video_date: videos.length > 0 ? videos[0].published_at : null,
        channel_image: videos.length > 0 ? videos[0].thumbnail_url : null,
        endpoint_url: `/api/youtube?channel_id=${encodeURIComponent(channelName.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
        description: `Videos from ${channelName}`,
        has_videos: (videoCount || 0) > 0
      });
    }
    
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
