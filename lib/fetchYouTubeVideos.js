// lib/fetchYouTubeVideos.js - YouTube video fetcher for motocross channels
import { supabase } from './supabaseClient.js';

// YouTube Data API v3 configuration
const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Motocross YouTube channels to monitor
const CHANNELS_CONFIG = [
  { handle: '@VitalMX', name: 'Vital MX' },
  { handle: '@RacerXIllustrated', name: 'Racer X' },
  { handle: '@AmericanMotocross', name: 'Pro Motocross' },
  { handle: '@supercrosslive', name: 'Monster Energy Supercross' },
  { handle: '@PulpMX', name: 'PulpMX' },
  { handle: '@Keeferinctesting', name: 'Keefer Inc Testing' },
  { handle: '@swapmotolive', name: 'Swap Moto Live' },
  { handle: '@MXVice', name: 'MX Vice' },
  { handle: '@GypsyTales', name: 'Gypsy Tales' },
  { handle: '@DirtBikeMagazine', name: 'Dirt Bike Magazine' },
  { handle: '@MotocrossActionMag', name: 'Motocross Action' },
  { handle: '@FOXracing', name: 'Fox Racing' },
  { handle: '@motoplayground', name: 'Moto Playground' },
  { handle: '@WSXOfficial', name: 'World Supercross' },
  { handle: '@teamfried8326', name: 'Team Fried' }
];

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

// Get channel ID from handle
async function resolveChannelId(handle) {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  
  try {
    // Try forHandle first (for @ handles)
    const response = await callYouTubeAPI('channels', {
      part: 'id,snippet,contentDetails',
      forHandle: cleanHandle
    });
    
    if (response.items && response.items.length > 0) {
      const channel = response.items[0];
      const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
      return {
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        uploadsPlaylistId: uploadsId
      };
    }
    
    throw new Error(`Channel not found: ${handle}`);
  } catch (error) {
    console.error(`Error resolving channel ${handle}:`, error.message);
    return null;
  }
}

// Fetch new videos from a channel's uploads playlist
async function fetchChannelVideos(channel, lastVideoId = null, daysBack = 1) {
  // Check if we have a valid uploads playlist ID
  if (!channel.uploads_playlist_id) {
    console.log(`  ⚠️ No uploads playlist ID for ${channel.display_name}`);
    return [];
  }
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const newVideos = [];
  let pageToken = undefined;
  let foundLastVideo = false;
  let hitOldContent = false;
  
  do {
    try {
      // Get playlist items (newest first)
      const response = await callYouTubeAPI('playlistItems', {
        part: 'contentDetails,snippet',
        playlistId: channel.uploads_playlist_id,
        maxResults: 50,
        ...(pageToken && { pageToken }) // Only include if pageToken exists
      });
      
      for (const item of response.items || []) {
        const videoId = item.contentDetails.videoId;
        const publishedAt = new Date(item.contentDetails.videoPublishedAt || item.snippet.publishedAt);
        
        // Skip videos older than cutoff date
        if (publishedAt < cutoffDate) {
          hitOldContent = true;
          break;
        }
        
        // Stop if we hit the last video we've seen (for regular updates)
        if (lastVideoId && videoId === lastVideoId) {
          foundLastVideo = true;
          break;
        }
        
        // Add video info
        newVideos.push({
          videoId: videoId,
          publishedAt: publishedAt.toISOString(),
          title: item.snippet.title,
          description: item.snippet.description
        });
      }
      
      if (foundLastVideo || hitOldContent) break;
      pageToken = response.nextPageToken;
      
      // Limit to prevent runaway pagination
      if (newVideos.length > 50) break; // Reduced from 100 to be more reasonable
      
    } catch (error) {
      console.error(`  Error fetching videos: ${error.message}`);
      break;
    }
    
  } while (pageToken);
  
  return newVideos;
}

// Get detailed video information
async function getVideoDetails(videoIds) {
  if (videoIds.length === 0) return [];
  
  const details = [];
  
  // Process in batches of 50 (API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    
    const response = await callYouTubeAPI('videos', {
      part: 'snippet,contentDetails,player,status',
      id: batch.join(',')
    });
    
    for (const video of response.items || []) {
      const snippet = video.snippet;
      const thumbnails = snippet.thumbnails || {};
      
      // Get best available thumbnail
      const thumbnailUrl = thumbnails.maxres?.url || 
                          thumbnails.standard?.url || 
                          thumbnails.high?.url || 
                          thumbnails.medium?.url || 
                          thumbnails.default?.url || '';
      
      details.push({
        video_id: video.id,
        channel_id: snippet.channelId,
        channel_title: snippet.channelTitle,
        title: snippet.title,
        description: snippet.description,
        published_at: snippet.publishedAt,
        duration: video.contentDetails?.duration || '',
        thumbnail_url: thumbnailUrl,
        embeddable: video.status?.embeddable || false,
        embed_html: video.player?.embedHtml || ''
      });
    }
  }
  
  return details;
}

// Main function to fetch YouTube videos
async function fetchYouTubeVideos(daysBack = 1) {
  if (!YT_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY not configured');
    return { success: false, error: 'Missing API key' };
  }
  
  const startTime = Date.now();
  let totalVideos = 0;
  let processedChannels = 0;
  
  try {
    console.log(`📺 Starting YouTube video fetch (${daysBack} days)...`);
    
    // Get or create YouTube channels in database
    for (const config of CHANNELS_CONFIG) {
      try {
        // Check if channel exists in database
        const { data: existingChannel } = await supabase
          .from('youtube_channels')
          .select('*')
          .eq('handle', config.handle)
          .single();
        
        if (!existingChannel) {
          // Resolve channel details from YouTube
          const channelInfo = await resolveChannelId(config.handle);
          
          if (channelInfo && channelInfo.uploadsPlaylistId) {
            // Store channel in database
            const { error: insertError } = await supabase
              .from('youtube_channels')
              .insert({
                handle: config.handle,
                channel_id: channelInfo.channelId,
                channel_title: channelInfo.channelTitle,
                display_name: config.name,
                uploads_playlist_id: channelInfo.uploadsPlaylistId,
                is_active: true
              });
            
            if (!insertError) {
              console.log(`✅ Added channel: ${config.name}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${config.handle}:`, error.message);
      }
    }
    
    // Fetch active channels from database
    const { data: channels, error: channelError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('is_active', true);
    
    if (channelError) throw channelError;
    
    console.log(`📊 Processing ${channels.length} active channels...`);
    
    // Process each channel
    for (const channel of channels) {
      try {
        console.log(`📥 Checking ${channel.display_name}...`);
        
        // Skip channels with invalid playlist IDs
        if (!channel.uploads_playlist_id) {
          console.log(`  ⚠️ Skipping - no uploads playlist ID`);
          continue;
        }
        
        // Fetch new videos since last check
        const newVideos = await fetchChannelVideos(channel, channel.last_video_id, daysBack);
        
        if (newVideos.length === 0) {
          console.log(`  No new videos`);
          continue;
        }
        
        console.log(`  Found ${newVideos.length} new videos`);
        
        // Get detailed information for new videos
        const videoIds = newVideos.map(v => v.videoId);
        const videoDetails = await getVideoDetails(videoIds);
        
        // Store videos in database
        if (videoDetails.length > 0) {
          const { error: insertError } = await supabase
            .from('youtube_videos')
            .upsert(videoDetails, {
              onConflict: 'video_id',
              ignoreDuplicates: false
            });
          
          if (insertError) {
            console.error(`  Error inserting videos:`, insertError);
          } else {
            totalVideos += videoDetails.length;
            
            // Update channel's last video ID
            const newestVideo = videoDetails[0];
            await supabase
              .from('youtube_channels')
              .update({
                last_video_id: newestVideo.video_id,
                last_fetched: new Date().toISOString()
              })
              .eq('channel_id', channel.channel_id);
          }
        }
        
        processedChannels++;
        
      } catch (error) {
        console.error(`❌ Error processing ${channel.display_name}: ${error.message}`);
        // Continue with next channel instead of stopping
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ YouTube fetch complete: ${totalVideos} new videos from ${processedChannels} channels in ${duration}s`);
    
    return { 
      success: true, 
      videosAdded: totalVideos, 
      channelsProcessed: processedChannels 
    };
    
  } catch (error) {
    console.error('💥 Fatal error in YouTube fetch:', error);
    return { success: false, error: error.message };
  }
}

export { fetchYouTubeVideos };
