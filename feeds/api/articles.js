// api/articles.js - UPDATED with clean URL mappings for all your feeds
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
        company,
        group_by_source = 'false',
        sources // Multi-source filtering with pipe (|) delimiter
      } = req.query;

      let query = supabase
        .from('articles')
        .select('*')
        .order('published_date', { ascending: false });

      // Multi-source filtering
      // Uses pipe (|) as delimiter to handle source names with commas (e.g., "keefer, Inc Testing")
      // Falls back to comma delimiter for backward compatibility if no pipes found
      if (sources) {
        const delimiter = sources.includes('|') ? '|' : ',';
        const sourceList = sources.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
        
        if (sourceList.length > 0) {
          query = query.in('company', sourceList);
        }
      }
      // Dynamic source mapping from database using existing fields
      else if (group_by_source && group_by_source !== 'false' && group_by_source !== 'true') {
        try {
          // Get all active feeds and find match by generated API code
          const { data: allFeeds, error: feedError } = await supabase
            .from('motocross_feeds')
            .select('feed_name')
            .eq('is_active', true);
          
          if (feedError) {
            console.warn(`Error fetching feeds for source: ${group_by_source}`, feedError);
            query = query.eq('company', group_by_source);
          } else {
            // Find feed where generated API code matches the request
            const matchingFeed = allFeeds.find(feed => {
              const apiCode = feed.feed_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
              return apiCode === group_by_source.toUpperCase();
            });
            
            if (matchingFeed) {
              // Use the actual feed name from database
              query = query.eq('company', matchingFeed.feed_name);
            } else {
              console.warn(`Feed not found for api_code: ${group_by_source}`);
              // Fallback to using the provided source code as-is
              query = query.eq('company', group_by_source);
            }
          }
        } catch (error) {
          console.error('Error looking up feed mapping:', error);
          // Fallback to using the provided source code as-is
          query = query.eq('company', group_by_source);
        }
      } else if (company) {
        // Direct company name filter (legacy support)
        query = query.eq('company', company);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data: articles, error } = await query;
      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        data: articles,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: articles.length
        },
        grouped_by_source: group_by_source !== 'false'
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
