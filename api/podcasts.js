// api/podcasts.js - Enhanced Podcast API with Show Organization
import { supabase } from '../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    switch (req.method) {
      case 'GET':
        const { 
          limit = 50, 
          offset = 0, 
          search, 
          podcast_name,
          group_by_show = 'false',
          debug_shows = 'false'
        } = req.query;

        // Debug endpoint to see all actual show names in database
        if (debug_shows === 'true') {
          const { data: allShows, error: debugError } = await supabase
            .from('podcasts')
            .select('podcast_name')
            .order('podcast_name');
          
          if (debugError) throw debugError;
          
          const uniqueShows = [...new Set(allShows.map(p => p.podcast_name))];
          return res.status(200).json({ 
            success: true, 
            debug: true,
            unique_show_names: uniqueShows,
            total_unique_shows: uniqueShows.length
          });
        }

        let query = supabase
          .from('podcasts')
          .select('*')
          .order('podcast_date', { ascending: false });

        // Handle show filtering with actual podcast names from podcasts table
        if (group_by_show && group_by_show !== 'false' && group_by_show !== 'true') {
          try {
            // Get all unique podcast names from podcasts table
            const { data: podcastNames, error: podcastError } = await supabase
              .from('podcasts')
              .select('podcast_name')
              .not('podcast_name', 'is', null);
            
            if (podcastError) {
              console.warn(`Error fetching podcast names for show: ${group_by_show}`, podcastError);
              query = query.eq('podcast_name', group_by_show);
            } else {
              // Find podcast where generated API code matches the request
              const uniquePodcastNames = [...new Set(podcastNames.map(item => item.podcast_name))];
              const matchingPodcast = uniquePodcastNames.find(podcastName => {
                const apiCode = podcastName.toUpperCase().replace(/[^A-Z0-9]/g, '');
                return apiCode === group_by_show.toUpperCase();
              });
              
              if (matchingPodcast) {
                // Use the actual podcast name from podcasts table
                query = query.eq('podcast_name', matchingPodcast);
              } else {
                console.warn(`Podcast not found for api_code: ${group_by_show}`);
                // Fallback to using the provided show code as-is
                query = query.eq('podcast_name', group_by_show);
              }
            }
          } catch (error) {
            console.error('Error looking up podcast mapping:', error);
            // Fallback to using the provided show code as-is
            query = query.eq('podcast_name', group_by_show);
          }
        } else if (podcast_name) {
          // Legacy support
          query = query.eq('podcast_name', podcast_name);
        }

        // Search functionality
        if (search) {
          query = query.or(`podcast_title.ilike.%${search}%,podcast_description.ilike.%${search}%`);
        }

        // Apply pagination
        query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data: podcasts, error } = await query;
        if (error) throw error;

        // Group by show if requested
        if (group_by_show === 'true') {
          const groupedData = {};
          
          podcasts.forEach(episode => {
            const showName = episode.podcast_name;
            
            if (!groupedData[showName]) {
              groupedData[showName] = {
                show_name: showName,
                show_image: episode.podcast_image,
                feed_url: episode.feed_url,
                episodes: []
              };
            }
            
            groupedData[showName].episodes.push({
              id: episode.id,
              title: episode.podcast_title,
              description: episode.podcast_description,
              published_date: episode.podcast_date,
              image_url: episode.podcast_image,
              audio_url: episode.audio_url,
              guid: episode.guid
            });
          });

          // Convert to array and add metadata
          const showsArray = Object.values(groupedData).map(show => ({
            ...show,
            episode_count: show.episodes.length,
            latest_episode_date: show.episodes[0]?.published_date || null
          }));

          // Sort by latest episode date
          showsArray.sort((a, b) => {
            if (!a.latest_episode_date) return 1;
            if (!b.latest_episode_date) return -1;
            return new Date(b.latest_episode_date) - new Date(a.latest_episode_date);
          });

          return res.status(200).json({ 
            success: true, 
            data: showsArray,
            total_shows: showsArray.length,
            grouped_by_show: true
          });
        }

        // Default response - flat list
        return res.status(200).json({ 
          success: true, 
          data: podcasts,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: podcasts.length
          },
          grouped_by_show: false
        });
      
      case 'POST':
        // Existing POST functionality
        const { 
          feed_url, 
          podcast_name: postPodcastName, 
          podcast_image, 
          podcast_title, 
          podcast_date, 
          podcast_description, 
          audio_url, 
          guid 
        } = req.body;
        
        if (!podcast_title || !feed_url) {
          return res.status(400).json({ 
            success: false, 
            error: 'podcast_title and feed_url are required' 
          });
        }
        
        const { data: newPodcast, error: postError } = await supabase
          .from('podcasts')
          .insert({ 
            feed_url, 
            podcast_name: postPodcastName, 
            podcast_image, 
            podcast_title, 
            podcast_date, 
            podcast_description, 
            audio_url,
            guid 
          })
          .select()
          .single();
        
        if (postError) throw postError;
        
        return res.status(201).json({ success: true, data: newPodcast });
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Podcasts API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}