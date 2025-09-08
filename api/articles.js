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
        group_by_source = 'false'
      } = req.query;

      let query = supabase
        .from('articles')
        .select('*')
        .order('published_date', { ascending: false });

      // Database-driven source filtering
      if (group_by_source && group_by_source !== 'false' && group_by_source !== 'true') {
        // Look up the source in motocross_feeds table by clean slug or company name
        const { data: sourceInfo, error: sourceError } = await supabase
          .from('motocross_feeds')
          .select('company_name')
          .or(`company_name.ilike.%${group_by_source}%`)
          .eq('is_active', true)
          .single();
        
        if (sourceError || !sourceInfo) {
          // Fallback: try direct company match
          query = query.eq('company', group_by_source);
        } else {
          // Use the actual company name from the database
          query = query.eq('company', sourceInfo.company_name);
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
