// api/trigger-video-pull.js - Manual trigger for video pulls from specific channel
import { supabase } from '../lib/supabaseClient.js';

// YouTube Data API v3 configuration
const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Helper to make YouTube API calls
async function callYouTubeAPI(endpoint, params) {
  const url = new URL(`${YT_API_BASE}/${endpoint}`);
  url.searchParams.append('key', YT_API_KEY);
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
  }
  
  return response.json();
}

// Fetch videos from a specific channel for X days
async function fetchChannelVideos(channel, daysBack) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const videos = [];
  let pageToken = null;
  
  do {
    const response = await callYouTubeAPI('playlistItems', {
      part: 'snippet',
      playlistId: channel.uploads_playlist_id,
      maxResults: 50,
      pageToken: pageToken
    });
    
    for (const item of response.items) {
      const publishedDate = new Date(item.snippet.publishedAt);
      
      // Stop if we've gone beyond our date range
      if (publishedDate < cutoffDate) {
        return videos;
      }
      
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        publishedAt: item.snippet.publishedAt,
        title: item.snippet.title
      });
    }
    
    pageToken = response.nextPageToken;
  } while (pageToken && videos.length < 200); // Safety limit
  
  return videos;
}

// Get detailed video information
async function getVideoDetails(videoIds) {
  if (videoIds.length === 0) return [];
  
  const videos = [];
  
  // Process in batches of 50 (API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    
    const response = await callYouTubeAPI('videos', {
      part: 'snippet,contentDetails,status',
      id: batch.join(',')
    });
    
    for (const video of response.items) {
      // Only include embeddable videos
      if (video.status.embeddable) {
        videos.push({
          video_id: video.id,
          channel_id: video.snippet.channelId,
          channel_title: video.snippet.channelTitle,
          title: video.snippet.title,
          description: video.snippet.description,
          published_at: video.snippet.publishedAt,
          thumbnail_url: video.snippet.thumbnails?.maxresdefault?.url || 
                        video.snippet.thumbnails?.high?.url ||
                        video.snippet.thumbnails?.medium?.url,
          duration: video.contentDetails.duration,
          embed_html: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${video.id}" frameborder="0" allowfullscreen></iframe>`,
          embeddable: true
        });
      }
    }
  }
  
  return videos;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Check if YouTube API key is configured
    if (!YT_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'YouTube API key not configured'
      });
    }
    
    const { channel_id, days = 7 } = req.body;
    
    if (!channel_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'channel_id is required' 
      });
    }
    
    // Validate days parameter
    const daysInt = parseInt(days);
    if (isNaN(daysInt) || daysInt < 1 || daysInt > 3650) {
      return res.status(400).json({ 
        success: false, 
        error: 'days must be a number between 1 and 3650 (10 years)' 
      });
    }
    
    console.log(`🎬 Manual video pull triggered for channel: ${channel_id}, days: ${daysInt}`);
    
    // Get the specific channel details
    const { data: channel, error: channelError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('channel_id', channel_id)
      .eq('is_active', true)
      .single();
    
    if (channelError || !channel) {
      return res.status(404).json({ 
        success: false, 
        error: `Channel ${channel_id} not found or not active` 
      });
    }
    
    console.log(`📺 Found channel: ${channel.display_name || channel.channel_title}`);
    
    // Fetch videos for this specific channel
    try {
      const startTime = Date.now();
      let totalVideos = 0;
      
      // Check if channel has valid playlist ID
      if (!channel.uploads_playlist_id) {
        return res.status(400).json({
          success: false,
          error: `Channel ${channel.display_name || channel.channel_title} has no uploads playlist ID configured`
        });
      }
      
      console.log(`🔄 Fetching videos for channel ${channel_id} for last ${daysInt} days`);
      
      // Fetch videos from this channel for the specified days
      const videos = await fetchChannelVideos(channel, daysInt);
      
      if (videos.length > 0) {
        console.log(`📥 Found ${videos.length} new videos to process`);
        
        // Get detailed video information
        const videoDetails = await getVideoDetails(videos.map(v => v.videoId));
        
        if (videoDetails.length > 0) {
          // Store videos in database
          const { error: insertError } = await supabase
            .from('youtube_videos')
            .upsert(videoDetails, {
              onConflict: 'video_id',
              ignoreDuplicates: false
            });
          
          if (insertError) {
            console.error(`❌ Error inserting videos:`, insertError);
            throw new Error(`Database insert failed: ${insertError.message}`);
          }
          
          totalVideos = videoDetails.length;
          
          // Update channel's last video ID and fetch time
          const newestVideo = videoDetails[0];
          await supabase
            .from('youtube_channels')
            .update({
              last_video_id: newestVideo.video_id,
              last_fetched: new Date().toISOString()
            })
            .eq('channel_id', channel_id);
          
          console.log(`✅ Successfully stored ${totalVideos} videos`);
        }
      } else {
        console.log(`📭 No new videos found for the last ${daysInt} days`);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      
      return res.status(200).json({
        success: true,
        message: `Manual video pull completed for ${channel.display_name || channel.channel_title}`,
        data: {
          channel_id: channel_id,
          channel_name: channel.display_name || channel.channel_title,
          days_requested: daysInt,
          videos_found: totalVideos,
          duration_seconds: duration,
          playlist_id: channel.uploads_playlist_id
        }
      });
      
    } catch (fetchError) {
      console.error(`❌ Error fetching videos for channel ${channel_id}:`, fetchError);
      return res.status(500).json({
        success: false,
        error: `Failed to fetch videos: ${fetchError.message}`
      });
    }
    
  } catch (error) {
    console.error('Manual video pull API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
