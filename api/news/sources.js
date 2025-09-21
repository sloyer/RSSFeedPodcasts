// api/news.js - News Sources Discovery API (similar to podcasts/shows)
import { supabase } from '../../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get all sources with their article stats in a single optimized query
    const { data: sourceStats, error } = await supabase
      .from('motocross_feeds')
      .select(`
        company_name,
        feed_name,
        is_active,
        articles!inner (
          id,
          published_date,
          image_url
        )
      `)
      .eq('is_active', true)
      .not('company_name', 'is', null)
      .order('articles.published_date', { ascending: false });
    
    if (error) throw error;
    
    // Process the data to group by source and get stats
    const sourceMap = new Map();
    
    sourceStats.forEach(row => {
      const companyName = row.company_name;
      
      if (!sourceMap.has(companyName)) {
        sourceMap.set(companyName, {
          source_name: companyName,
          feed_name: row.feed_name,
          article_count: 0,
          latest_article_date: null,
          source_image: null,
          endpoint_url: `/api/articles?group_by_source=${encodeURIComponent(companyName.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
          description: `Articles from ${companyName}`,
          has_articles: false
        });
      }
      
      const source = sourceMap.get(companyName);
      source.article_count++;
      source.has_articles = true;
      
      // Update latest article info if this is newer
      if (!source.latest_article_date || 
          new Date(row.articles.published_date) > new Date(source.latest_article_date)) {
        source.latest_article_date = row.articles.published_date;
        source.source_image = row.articles.image_url;
      }
    });
    
    // Convert to array
    const sourceData = Array.from(sourceMap.values());
    
    // Sort by latest article date (newest first), then by article count
    sourceData.sort((a, b) => {
      if (!a.latest_article_date && !b.latest_article_date) {
        return b.article_count - a.article_count;
      }
      if (!a.latest_article_date) return 1;
      if (!b.latest_article_date) return -1;
      return new Date(b.latest_article_date) - new Date(a.latest_article_date);
    });
    
    return res.status(200).json({
      success: true,
      data: sourceData,
      total_sources: sourceData.length
    });
    
  } catch (error) {
    console.error('News API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
