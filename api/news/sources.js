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
    // Get all active sources first
    const { data: sources, error: sourcesError } = await supabase
      .from('motocross_feeds')
      .select('company_name, feed_name, description, created_at')
      .eq('is_active', true)
      .not('company_name', 'is', null);
    
    if (sourcesError) throw sourcesError;
    
    // Get all articles for these sources in one query
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('company, published_date, image_url')
      .in('company', sources.map(s => s.company_name))
      .order('published_date', { ascending: false });
    
    if (articlesError) throw articlesError;
    
    // Process the data to group by source and get stats
    const sourceMap = new Map();
    
    // Initialize all sources
    sources.forEach(source => {
      // Check if source is new (added in last 45 days)
      const createdDate = new Date(source.created_at || 0);
      const fortyFiveDaysAgo = new Date();
      fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
      const is_new = createdDate > fortyFiveDaysAgo;
      
      sourceMap.set(source.company_name, {
        source_name: source.company_name,
        feed_name: source.feed_name,
        article_count: 0,
        latest_article_date: null,
        source_image: null,
        endpoint_url: `/api/articles?group_by_source=${encodeURIComponent(source.company_name.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
        description: source.description || `Articles from ${source.company_name}`,
        has_articles: false,
        is_new: is_new
      });
    });
    
    // Process articles to add stats
    articles.forEach(article => {
      const source = sourceMap.get(article.company);
      if (source) {
        source.article_count++;
        source.has_articles = true;
        
        // Update latest article info if this is newer
        if (!source.latest_article_date || 
            new Date(article.published_date) > new Date(source.latest_article_date)) {
          source.latest_article_date = article.published_date;
          source.source_image = article.image_url;
        }
      }
    });
    
    // Convert to array and filter out sources with 0 articles
    const sourceData = Array.from(sourceMap.values()).filter(s => s.article_count > 0);
    
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
