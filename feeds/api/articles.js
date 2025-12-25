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
      // Uses pipe (|) as primary delimiter to handle source names with commas (e.g., "keefer, Inc Testing")
      // If no pipe found, first check if the entire string is a valid source name before comma-splitting
      if (sources) {
        let sourceList;
        
        if (sources.includes('|')) {
          // Pipe delimiter - split on pipes
          sourceList = sources.split('|').map(s => s.trim()).filter(s => s.length > 0);
        } else if (sources.includes(',')) {
          // Has comma - could be multiple sources OR a single source with comma in name
          // First check if the entire string matches a company name
          const { data: exactMatch } = await supabase
            .from('articles')
            .select('company')
            .eq('company', sources.trim())
            .limit(1);
          
          if (exactMatch && exactMatch.length > 0) {
            // Entire string is a valid source name (contains comma)
            sourceList = [sources.trim()];
          } else {
            // Split on commas (multiple sources)
            sourceList = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        } else {
          // Single source, no delimiters
          sourceList = [sources.trim()];
        }
        
        // Filter by multiple companies using exact names
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
