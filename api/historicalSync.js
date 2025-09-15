 i// api/historicalSync.js - API endpoint for historical podcast sync
import { historicalPodcastSync } from '../../lib/historicalPodcastSync.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  // Simple authentication check
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing authorization header.' });
  }
  
  try {
    const { dry_run = 'false' } = req.query;
    const isDryRun = dry_run === 'true';
    
    console.log(`🎙️ Historical sync triggered via API (dry_run: ${isDryRun})`);
    
    const startTime = Date.now();
    const results = await historicalPodcastSync(isDryRun);
    const duration = (Date.now() - startTime) / 1000;
    
    const response = {
      success: true,
      dry_run: isDryRun,
      duration_seconds: Math.round(duration),
      summary: {
        total_episodes_processed: results.totalProcessed,
        new_episodes_added: results.totalNew,
        duplicates_skipped: results.totalDuplicates,
        errors: results.totalErrors
      },
      feed_details: results.feedResults,
      timestamp: new Date().toISOString(),
      message: isDryRun 
        ? `DRY RUN completed: Found ${results.totalProcessed} episodes, ${results.totalNew} would be added`
        : `Historical sync completed: ${results.totalNew} new episodes added from ${results.totalProcessed} total episodes`
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('💥 Historical sync API error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Historical sync failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
