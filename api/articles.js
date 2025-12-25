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
        sources // NEW: comma-separated API codes
      } = req.query;

      let query = supabase
        .from('articles')
        .select('*')
        .order('published_date', { ascending: false });

      // NEW: Multi-source filtering
      // Smart delimiter handling: supports pipe (|) for names with commas
      if (sources) {
        let sourceList;
        
        // If pipe delimiter is present, use it (explicitly multi-source)
        if (sources.includes('|')) {
          sourceList = sources.split('|').map(s => s.trim()).filter(s => s.length > 0);
        } else {
          // For comma delimiter, validate that split values exist as companies
          // This handles names with commas like "keefer, Inc Testing"
          const commaSplit = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
          
          // Get all valid company names from database
          const { data: validCompanies } = await supabase
            .from('motocross_feeds')
            .select('company_name')
            .eq('is_active', true);
          
          const validNames = new Set(validCompanies?.map(f => f.company_name) || []);
          
          // Check if ALL comma-split values are valid companies
          const allValid = commaSplit.every(s => validNames.has(s));
          
          if (allValid && commaSplit.length > 0) {
            // All values are valid companies - use comma split
            sourceList = commaSplit;
          } else {
            // Some values aren't valid - treat entire string as single source
            // This handles "keefer, Inc Testing" being split incorrectly
            sourceList = [sources.trim()];
          }
        }
        
        // Filter by multiple companies using exact names
        if (sourceList.length > 0) {
          query = query.in('company', sourceList);
        }
      }
      // Company name mapping using motocross_feeds table
      else if (group_by_source && group_by_source !== 'false' && group_by_source !== 'true') {
        try {
          // Get company names from motocross_feeds table
          const { data: feeds, error: feedError } = await supabase
            .from('motocross_feeds')
            .select('company_name')
            .eq('is_active', true)
            .not('company_name', 'is', null);
          
          if (feedError) {
            console.warn(`Error fetching feeds for source: ${group_by_source}`, feedError);
            query = query.eq('company', group_by_source);
          } else {
            // Find company where generated API code matches the request
            const matchingFeed = feeds.find(feed => {
              const apiCode = feed.company_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
              return apiCode === group_by_source.toUpperCase();
            });
            
            if (matchingFeed) {
              // Use the actual company name from motocross_feeds table
              query = query.eq('company', matchingFeed.company_name);
            } else {
              console.warn(`Company not found for api_code: ${group_by_source}`);
              // Fallback to using the provided source code as-is
              query = query.eq('company', group_by_source);
            }
          }
        } catch (error) {
          console.error('Error looking up company mapping:', error);
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
