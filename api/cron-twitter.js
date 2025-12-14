// api/cron-twitter.js - Dedicated Twitter cron (every 10 minutes)
import { fetchTwitterFeeds } from '../lib/fetchTwitter.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const startTime = Date.now();
    console.log('🐦 Twitter cron started (5-minute interval)');
    
    const twitterResults = await fetchTwitterFeeds(2); // Last 48 hours
    
    const duration = (Date.now() - startTime) / 1000;
    
    res.status(200).json({
      message: `Twitter cron completed in ${duration}s`,
      result: twitterResults.success 
        ? `success: ${twitterResults.tweetsAdded} tweets from ${twitterResults.accountsProcessed} accounts`
        : `error: ${twitterResults.error}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Twitter cron error:', error);
    res.status(500).json({
      error: 'Failed to fetch Twitter feeds',
      message: error.message
    });
  }
}

