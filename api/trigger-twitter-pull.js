// api/trigger-twitter-pull.js - Manual Twitter fetch trigger
import { fetchTwitterFeeds } from '../lib/fetchTwitter.js';

// Simple rate limiting (in-memory, resets on function cold start)
let lastTriggerTime = 0;
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Rate limiting check
    const now = Date.now();
    if (now - lastTriggerTime < RATE_LIMIT_MS) {
      const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastTriggerTime)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Rate limited. Please wait ${waitTime} seconds.`
      });
    }
    
    console.log('🐦 Manual Twitter pull triggered');
    
    const startTime = Date.now();
    const results = await fetchTwitterFeeds(3); // Last 3 days
    const duration = (Date.now() - startTime) / 1000;
    
    // Update last trigger time
    lastTriggerTime = now;
    
    return res.status(200).json({
      success: results.success,
      message: results.success 
        ? `Manual Twitter pull completed` 
        : `Twitter pull failed: ${results.error}`,
      data: {
        tweets_fetched: results.tweetsAdded || 0,
        accounts_processed: results.accountsProcessed || 0,
        duration_seconds: duration
      }
    });
    
  } catch (error) {
    console.error('Manual Twitter pull API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}

