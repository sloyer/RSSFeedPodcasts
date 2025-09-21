// api/news.js - News Sources Discovery API (similar to podcasts/shows)
import { supabase } from '../../../lib/supabaseClient.js';

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
    // Get all active motocross feeds (news sources)
    const { data: feeds, error: feedsError } = await supabase
      .from('motocross_feeds')
      .select('*')
      .eq('is_active', true)
      .not('company_name', 'is', null)
      .order('company_name', { ascending: true });
    
    if (feedsError) throw feedsError;
    
    // Get article counts for each source
    const sourceData = [];
    
    for (const feed of feeds) {
      // Get article count and latest article for this source
      const { data: articles, error: articleError } = await supabase
        .from('articles')
        .select('id, published_date, image_url')
        .eq('company', feed.company_name)
        .order('published_date', { ascending: false })
        .limit(1);
      
      if (articleError) {
        console.warn(`Error fetching articles for source ${feed.company_name}:`, articleError);
        continue;
      }
      
      // Get total article count for this source
      const { count: articleCount, error: countError } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('company', feed.company_name);
      
      if (countError) {
        console.warn(`Error counting articles for source ${feed.company_name}:`, countError);
      }
      
      sourceData.push({
        source_name: feed.company_name,
        feed_name: feed.feed_name,
        article_count: articleCount || 0,
        latest_article_date: articles.length > 0 ? articles[0].published_date : null,
        source_image: articles.length > 0 ? articles[0].image_url : null,
        endpoint_url: `/api/articles?group_by_source=${encodeURIComponent(feed.company_name.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`,
        description: `Articles from ${feed.company_name}`,
        has_articles: (articleCount || 0) > 0
      });
    }
    
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
