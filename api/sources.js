// api/sources.js - Get all available content sources for user preferences
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
      const { type } = req.query; // 'podcast', 'article', 'youtube', or 'all'
      
      let query = supabase
        .from('available_content_sources')
        .select('*')
        .order('display_name');
      
      // Filter by content type if specified
      if (type && type !== 'all') {
        query = query.eq('content_type', type);
      }
      
      const { data: sources, error } = await query;
      
      if (error) throw error;
      
      // Group by content type for easier consumption
      const groupedSources = {
        podcasts: sources.filter(s => s.content_type === 'podcast'),
        articles: sources.filter(s => s.content_type === 'article'),
        youtube: sources.filter(s => s.content_type === 'youtube')
      };
      
      return res.status(200).json({
        success: true,
        data: type && type !== 'all' ? sources : groupedSources,
        total_sources: sources.length,
        breakdown: {
          podcasts: groupedSources.podcasts.length,
          articles: groupedSources.articles.length,
          youtube: groupedSources.youtube.length
        }
      });
      
    } catch (error) {
      console.error('Sources API error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
