// api/add-youtube-channel-url.js - Add YouTube channel by URL (easy mode)
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

// Extract channel identifier from various YouTube URL formats
function extractChannelIdentifier(url) {
  try {
    const urlObj = new URL(url);
    
    // Handle different YouTube URL formats:
    // https://www.youtube.com/channel/UCxxxxx
    // https://www.youtube.com/c/channelname
    // https://www.youtube.com/user/username  
    // https://www.youtube.com/@handle
    // https://youtube.com/@handle
    
    const pathname = urlObj.pathname;
    
    // Direct channel ID: /channel/UCxxxxx
    if (pathname.startsWith('/channel/')) {
      return {
        type: 'channel_id',
        value: pathname.split('/')[2]
      };
    }
    
    // Custom URL: /c/channelname
    if (pathname.startsWith('/c/')) {
      return {
        type: 'custom_url',
        value: pathname.split('/')[2]
      };
    }
    
    // Legacy username: /user/username
    if (pathname.startsWith('/user/')) {
      return {
        type: 'username',
        value: pathname.split('/')[2]
      };
    }
    
    // Handle format: /@handle
    if (pathname.startsWith('/@')) {
      return {
        type: 'handle',
        value: pathname.slice(2) // Remove /@
      };
    }
    
    // Handle without @: /handle (some URLs)
    if (pathname.startsWith('/') && pathname.split('/').length === 2) {
      const handle = pathname.slice(1);
      if (handle && !handle.includes('.')) { // Avoid paths like /watch
        return {
          type: 'handle',
          value: handle
        };
      }
    }
    
    throw new Error('Could not extract channel identifier from URL');
  } catch (error) {
    throw new Error(`Invalid YouTube URL: ${error.message}`);
  }
}

// Get channel details from YouTube API using various identifiers
async function getChannelDetails(identifier) {
  const { type, value } = identifier;
  
  let response;
  
  try {
    switch (type) {
      case 'channel_id':
        response = await callYouTubeAPI('channels', {
          part: 'id,snippet,contentDetails',
          id: value
        });
        break;
        
      case 'handle':
        response = await callYouTubeAPI('channels', {
          part: 'id,snippet,contentDetails',
          forHandle: value
        });
        break;
        
      case 'username':
        response = await callYouTubeAPI('channels', {
          part: 'id,snippet,contentDetails',
          forUsername: value
        });
        break;
        
      case 'custom_url':
        // For custom URLs, we need to try handle format first
        try {
          response = await callYouTubeAPI('channels', {
            part: 'id,snippet,contentDetails',
            forHandle: value
          });
        } catch (error) {
          // If handle doesn't work, try as username
          response = await callYouTubeAPI('channels', {
            part: 'id,snippet,contentDetails',
            forUsername: value
          });
        }
        break;
        
      default:
        throw new Error(`Unsupported identifier type: ${type}`);
    }
    
    if (!response.items || response.items.length === 0) {
      throw new Error(`Channel not found for ${type}: ${value}`);
    }
    
    const channel = response.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    
    if (!uploadsPlaylistId) {
      throw new Error('Channel does not have an uploads playlist');
    }
    
    return {
      channel_id: channel.id,
      channel_title: channel.snippet.title,
      description: channel.snippet.description,
      display_name: channel.snippet.title,
      uploads_playlist_id: uploadsPlaylistId,
      handle: `@${channel.snippet.customUrl || channel.snippet.title.replace(/[^a-zA-Z0-9]/g, '')}`,
      thumbnail_url: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url
    };
    
  } catch (error) {
    throw new Error(`Failed to get channel details: ${error.message}`);
  }
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
    
    const { url, display_name, is_active = true } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube channel URL is required'
      });
    }
    
    console.log(`🔍 Processing YouTube URL: ${url}`);
    
    // Extract channel identifier from URL
    const identifier = extractChannelIdentifier(url);
    console.log(`📋 Extracted identifier:`, identifier);
    
    // Get channel details from YouTube API
    const channelDetails = await getChannelDetails(identifier);
    console.log(`📺 Found channel: ${channelDetails.channel_title}`);
    
    // Check if channel already exists
    const { data: existingChannel } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('channel_id', channelDetails.channel_id)
      .single();
    
    if (existingChannel) {
      return res.status(400).json({
        success: false,
        error: `Channel "${channelDetails.channel_title}" already exists in database`,
        existing_channel: existingChannel
      });
    }
    
    // Insert new channel into database
    const channelData = {
      handle: channelDetails.handle,
      channel_id: channelDetails.channel_id,
      channel_title: channelDetails.channel_title,
      display_name: display_name || channelDetails.display_name,
      uploads_playlist_id: channelDetails.uploads_playlist_id,
      is_active: is_active,
      last_video_id: null,
      last_fetched: null
    };
    
    const { data: insertedChannel, error: insertError } = await supabase
      .from('youtube_channels')
      .insert(channelData)
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }
    
    console.log(`✅ Successfully added channel: ${channelDetails.channel_title}`);
    
    return res.status(200).json({
      success: true,
      message: `Successfully added YouTube channel: ${channelDetails.channel_title}`,
      data: {
        ...insertedChannel,
        thumbnail_url: channelDetails.thumbnail_url,
        description: channelDetails.description,
        original_url: url
      }
    });
    
  } catch (error) {
    console.error('Add YouTube channel URL API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
