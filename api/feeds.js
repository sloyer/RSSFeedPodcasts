
// api/feeds.js - Manage RSS Feed Sources
import { supabase } from '../../lib/supabaseClient.js';

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
        // Get all RSS feed sources
        const { data: feeds, error: getError } = await supabase
          .from('rss_feeds')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (getError) throw getError;
        
        return res.status(200).json({ success: true, data: feeds });
      
      case 'POST':
        // Add new RSS feed
        const { feed_url, feed_name } = req.body;
        
        if (!feed_url || !feed_name) {
          return res.status(400).json({ 
            success: false, 
            error: 'feed_url and feed_name are required' 
          });
        }
        
        const { data: newFeed, error: postError } = await supabase
          .from('rss_feeds')
          .insert({ feed_url, feed_name })
          .select()
          .single();
        
        if (postError) throw postError;
        
        return res.status(201).json({ success: true, data: newFeed });
      
      case 'DELETE':
        // Remove RSS feed
        const { id } = req.query;
        
        if (!id) {
          return res.status(400).json({ 
            success: false, 
            error: 'Feed ID is required' 
          });
        }
        
        const { error: deleteError } = await supabase
          .from('rss_feeds')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;
        
        return res.status(200).json({ 
          success: true, 
          message: 'Feed deleted successfully' 
        });
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Feeds API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Server error' 
    });
  }
}