// api/cron.js - Updated with YouTube video fetching
import { fetchAndStoreFeeds } from '../lib/fetchFeeds.js';
import { fetchMotocrossFeeds } from '../lib/fetchMotocrossFeeds.js';
import { fetchYouTubeVideos } from '../lib/fetchYouTubeVideos.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const startTime = Date.now();
    console.log('🔄 Cron job started');
    
    const results = {};
    
    // STEP 1: Fetch podcasts
    try {
      await fetchAndStoreFeeds();
      results.podcasts = 'success';
      console.log('✅ Podcasts completed');
    } catch (error) {
      results.podcasts = `error: ${error.message}`;
      console.log('❌ Podcasts failed:', error.message);
    }
    
    // STEP 2: Fetch articles
    try {
      let dateParam = req.query.date || false;
      
      if (req.query.days) {
        dateParam = `days:${req.query.days}`;
        console.log(`📰 Fetching ${req.query.days} days of articles...`);
      } else if (dateParam) {
        console.log(`🎯 Test mode: fetching articles for ${dateParam}`);
      } else {
        console.log('🔄 Normal mode: fetching recent articles');
      }
      
      const articleResults = await fetchMotocrossFeeds(dateParam);
      results.articles = `success: ${articleResults.articlesProcessed} articles, ${articleResults.feedsSkipped} feeds skipped`;
      console.log('✅ Articles completed');
    } catch (error) {
      results.articles = `error: ${error.message}`;
      console.log('❌ Articles failed:', error.message);
    }
    
    // STEP 3: Fetch YouTube videos (NEW)
    try {
      console.log('📺 Starting YouTube video fetch...');
      
      // Get days parameter for YouTube (default to 1 day for regular runs)
      const youtubeDays = req.query.days ? parseInt(req.query.days) : 1;
      const youtubeResults = await fetchYouTubeVideos(youtubeDays);
      
      if (youtubeResults.success) {
        results.youtube = `success: ${youtubeResults.videosAdded} videos from ${youtubeResults.channelsProcessed} channels`;
        console.log('✅ YouTube completed');
      } else {
        results.youtube = `error: ${youtubeResults.error}`;
        console.log('❌ YouTube failed:', youtubeResults.error);
      }
    } catch (error) {
      results.youtube = `error: ${error.message}`;
      console.log('❌ YouTube failed:', error.message);
    }
    
    const duration = (Date.now() - startTime) / 1000;
    
    res.status(200).json({ 
      message: `Cron completed in ${duration}s`,
      results: results,
      timestamp: new Date().toISOString(),
      mode: req.query.date ? `test (${req.query.date})` : req.query.days ? `bulk (${req.query.days} days)` : 'normal'
    });
    
  } catch (error) {
    console.error('💥 Cron error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch feeds',
      message: error.message
    });
  }
}
