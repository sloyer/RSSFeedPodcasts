// api/tweets.js - Tweets API with multi-account filtering
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
        accounts // NEW: comma-separated usernames
      } = req.query;

      let query = supabase
        .from('tweets')
        .select('*')
        .order('posted_at', { ascending: false });

      // Multi-account filtering
      if (accounts) {
        const accountList = accounts.split(',').map(a => a.trim());
        
        if (accountList.length > 0) {
          query = query.in('account_username', accountList);
        }
      }

      // Search in tweet text
      if (search) {
        query = query.ilike('text', `%${search}%`);
      }

      // Apply pagination
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data: tweets, error } = await query;
      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        data: tweets,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: tweets.length
        }
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

