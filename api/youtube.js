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

      // Handle channel filtering with clean URL mappings
      if (channel_id) {
        // Clean URL mappings for YouTube channels (matches article pattern)
        const channelMappings = {
          'VITALMX': 'UCCmGhVaQX10ok72CmJMa_oQ',
          'VITAL': 'UCCmGhVaQX10ok72CmJMa_oQ',
          'RACERX': 'UCzLDrufzDTIQX_F20r0EiMA',
          'RACER': 'UCzLDrufzDTIQX_F20r0EiMA',
          'RACERXONLINE': 'UCzLDrufzDTIQX_F20r0EiMA',
          'PROMX': 'UCKtQ4DDoVusEa1i_Q8OEyew',
          'PROMOTO': 'UCKtQ4DDoVusEa1i_Q8OEyew',
          'PROMOTOCROSS': 'UCKtQ4DDoVusEa1i_Q8OEyew',
          'SUPERCROSS': 'UCkaNo2FUEWips2z4BkOHl6Q',
          'SX': 'UCkaNo2FUEWips2z4BkOHl6Q',
          'MONSTERENERGY': 'UCkaNo2FUEWips2z4BkOHl6Q',
          'PULPMX': 'UCpMfM2f4b6ehg1H_olAx02Q',
          'PULP': 'UCpMfM2f4b6ehg1H_olAx02Q',
          'KEEFER': 'UCZYeudqmABko6_88Isi9JNw',
          'KEEFERINC': 'UCZYeudqmABko6_88Isi9JNw',
          'KEEFERTESTING': 'UCZYeudqmABko6_88Isi9JNw',
          'SWAPMOTO': 'UCvOh-WOBvelVw2akcAdjyMQ',
          'SWAP': 'UCvOh-WOBvelVw2akcAdjyMQ',
          'SWAPMOTOLIVE': 'UCvOh-WOBvelVw2akcAdjyMQ',
          'MXVICE': 'UCxeEsENwOA2ni3hPqJBhYKg',
          'VICE': 'UCxeEsENwOA2ni3hPqJBhYKg',
          'GYPSYTALES': 'UCtl-RTKdYdCzf8hUnuGRiBg',
          'GYPSY': 'UCtl-RTKdYdCzf8hUnuGRiBg',
          'DIRTBIKE': 'UCeKccRs9icuvfnQ2Z6Yf6gQ',
          'DIRTBIKEMAG': 'UCeKccRs9icuvfnQ2Z6Yf6gQ',
          'DIRTBIKEMAGAZINE': 'UCeKccRs9icuvfnQ2Z6Yf6gQ',
          'MXA': 'UCOvXlniUlngzER5ery9K27w',
          'MOTOCROSSACTION': 'UCOvXlniUlngzER5ery9K27w',
          'MXACTION': 'UCOvXlniUlngzER5ery9K27w',
          'FOX': 'UCRuCx-QoX3PbPaM2NEWw-Tw',
          'FOXRACING': 'UCRuCx-QoX3PbPaM2NEWw-Tw',
          'MOTOPLAYGROUND': 'UCKWef39yZsgnP0hytNcWt3A',
          'PLAYGROUND': 'UCKWef39yZsgnP0hytNcWt3A',
          'WSX': 'UCz2xUzjvrlvBWmpJAovRtUw',
          'WORLDSX': 'UCz2xUzjvrlvBWmpJAovRtUw',
          'WORLDSUPERCROSS': 'UCz2xUzjvrlvBWmpJAovRtUw',
          'TEAMFRIED': 'UCWZ754dvJICH2H5RvKSbdkg',
          'FRIED': 'UCWZ754dvJICH2H5RvKSbdkg'
        };
        
        // Convert to uppercase and look up the actual channel ID
        const actualChannelId = channelMappings[channel_id.toUpperCase()] || channel_id;
        query = query.eq('channel_id', actualChannelId);
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
