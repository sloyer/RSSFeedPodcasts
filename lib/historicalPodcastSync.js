// lib/historicalPodcastSync.js - Historical sync for PulpMX and Steve Matthes podcasts
import Parser from 'rss-parser';
import { supabase } from './supabaseClient.js';

const parser = new Parser({
  customFields: {
    feed: ['image', 'itunes:image'],
    item: ['itunes:image', 'enclosure']
  }
});

// Rate limiting configuration to be respectful to servers
const RATE_LIMIT = {
  delayBetweenRequests: 2000, // 2 seconds between requests
  batchSize: 20, // Process 20 episodes at a time
  delayBetweenBatches: 5000, // 5 seconds between batches
  maxRetries: 3
};

// Target feeds for historical sync
const HISTORICAL_FEEDS = [
  {
    feed_url: 'https://www.pulpmx.com/apptabs/z_tsms.xml',
    feed_name: 'The Steve Matthes Show',
    description: 'Steve Matthes Show - Full Historical Sync'
  },
  {
    feed_url: 'https://www.pulpmx.com/apptabs/z_pmxs.xml', 
    feed_name: 'PulpMX Show',
    description: 'PulpMX Show - Full Historical Sync'
  }
];

// Helper function to sleep/delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced error handling with retries
async function fetchWithRetry(url, retries = RATE_LIMIT.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  📥 Fetching feed (attempt ${attempt}/${retries})...`);
      
      // Add delay before each request to be respectful
      if (attempt > 1) {
        await sleep(RATE_LIMIT.delayBetweenRequests * attempt);
      }
      
      const feed = await parser.parseURL(url);
      return feed;
    } catch (error) {
      console.error(`  ❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to fetch after ${retries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await sleep(RATE_LIMIT.delayBetweenRequests * Math.pow(2, attempt));
    }
  }
}

// Process episodes in batches to avoid overwhelming the database
async function processBatch(episodes, feedConfig) {
  const batchData = [];
  
  for (const item of episodes) {
    try {
      // Extract audio URL from enclosure
      let audioUrl = '';
      if (item.enclosure && item.enclosure.url) {
        audioUrl = item.enclosure.url;
      } else if (Array.isArray(item.enclosure) && item.enclosure[0] && item.enclosure[0].url) {
        audioUrl = item.enclosure[0].url;
      } else if (item.link && item.link.includes('.mp3')) {
        audioUrl = item.link;
      }

      const podcastData = {
        feed_url: feedConfig.feed_url,
        podcast_name: feedConfig.feed_title || feedConfig.feed_name,
        podcast_title: item.title || 'Untitled',
        podcast_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        podcast_description: item.contentSnippet || item.content || '',
        podcast_image: item['itunes:image'] || 
                      feedConfig.feed_image || 
                      '',
        audio_url: audioUrl,
        guid: item.guid || item.link || `${feedConfig.feed_url}-${item.title}-${item.pubDate}`
      };

      batchData.push(podcastData);
    } catch (itemError) {
      console.error(`  ⚠️ Error processing episode "${item.title}":`, itemError.message);
      // Continue with other episodes
    }
  }

  return batchData;
}

// Main historical sync function
async function historicalPodcastSync(dryRun = false) {
  const startTime = Date.now();
  console.log('🎙️ Starting Historical Podcast Sync');
  console.log(`📊 Rate Limiting: ${RATE_LIMIT.delayBetweenRequests}ms between requests, ${RATE_LIMIT.batchSize} episodes per batch`);
  console.log(`🧪 Dry Run Mode: ${dryRun ? 'ON (no database writes)' : 'OFF (will write to database)'}`);
  console.log(`🎯 Target Feeds: ${HISTORICAL_FEEDS.length} feeds (PulpMX Show + Steve Matthes Show)`);
  console.log('');

  const results = {
    totalProcessed: 0,
    totalNew: 0,
    totalDuplicates: 0,
    totalErrors: 0,
    feedResults: []
  };

  for (let feedIndex = 0; feedIndex < HISTORICAL_FEEDS.length; feedIndex++) {
    const feedConfig = HISTORICAL_FEEDS[feedIndex];
    try {
      console.log(`🎯 Processing Feed ${feedIndex + 1}/${HISTORICAL_FEEDS.length}: ${feedConfig.description}`);
      console.log(`📡 Feed URL: ${feedConfig.feed_url}`);
      
      // Respectful delay before starting each feed
      await sleep(RATE_LIMIT.delayBetweenRequests);
      
      const feed = await fetchWithRetry(feedConfig.feed_url);
      const items = feed.items || [];
      
      // Store feed metadata for episode processing
      const feedWithMeta = {
        ...feedConfig,
        feed_title: feed.title,
        feed_image: feed.image?.url || feed['itunes:image']?.href || ''
      };
      
      console.log(`📺 Found ${items.length} total episodes in feed`);
      console.log(`📅 Date range: ${items[items.length - 1]?.pubDate || 'Unknown'} to ${items[0]?.pubDate || 'Unknown'}`);
      
      // Estimate processing time
      const totalBatches = Math.ceil(items.length / RATE_LIMIT.batchSize);
      const estimatedMinutes = Math.round((totalBatches * RATE_LIMIT.delayBetweenBatches) / 1000 / 60);
      console.log(`⏱️ Estimated processing time: ~${estimatedMinutes} minutes (${totalBatches} batches)`);
      console.log('');
      
      let newEpisodes = 0;
      let duplicates = 0;
      let errors = 0;
      
      // Process episodes in batches
      for (let i = 0; i < items.length; i += RATE_LIMIT.batchSize) {
        const batch = items.slice(i, i + RATE_LIMIT.batchSize);
        const batchNum = Math.floor(i / RATE_LIMIT.batchSize) + 1;
        const totalBatches = Math.ceil(items.length / RATE_LIMIT.batchSize);
        
        console.log(`  📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} episodes)`);
        
        // Show current episode being processed
        const firstEpisode = batch[0];
        const episodeDate = firstEpisode.pubDate ? new Date(firstEpisode.pubDate).toLocaleDateString() : 'Unknown date';
        console.log(`     📅 ${episodeDate} - "${firstEpisode.title?.substring(0, 50)}..."`);
        
        try {
          const batchData = await processBatch(batch, feedWithMeta);
          
          if (!dryRun && batchData.length > 0) {
            // Check for existing episodes first
            const guids = batchData.map(ep => ep.guid);
            const { data: existing } = await supabase
              .from('podcasts')
              .select('guid')
              .in('guid', guids);
            
            const existingGuids = new Set(existing?.map(ep => ep.guid) || []);
            const newEpisodes_batch = batchData.filter(ep => !existingGuids.has(ep.guid));
            const duplicates_batch = batchData.length - newEpisodes_batch.length;
            
            if (newEpisodes_batch.length > 0) {
              const { error: insertError } = await supabase
                .from('podcasts')
                .insert(newEpisodes_batch);
              
              if (insertError) {
                console.error(`  ❌ Database error:`, insertError.message);
                errors += newEpisodes_batch.length;
              } else {
                newEpisodes += newEpisodes_batch.length;
                duplicates += duplicates_batch;
                
                // Calculate progress percentage
                const progressPercent = Math.round(((i + batch.length) / items.length) * 100);
                console.log(`  ✅ Inserted ${newEpisodes_batch.length} new, ${duplicates_batch} duplicates | Progress: ${progressPercent}% (${i + batch.length}/${items.length})`);
              }
            } else {
              duplicates += duplicates_batch;
              const progressPercent = Math.round(((i + batch.length) / items.length) * 100);
              console.log(`  ⏭️ All ${duplicates_batch} episodes already exist | Progress: ${progressPercent}% (${i + batch.length}/${items.length})`);
            }
          } else if (dryRun) {
            console.log(`  🧪 DRY RUN: Would process ${batchData.length} episodes`);
            newEpisodes += batchData.length;
          }
          
          // Respectful delay between batches
          if (i + RATE_LIMIT.batchSize < items.length) {
            const remainingBatches = Math.ceil((items.length - (i + RATE_LIMIT.batchSize)) / RATE_LIMIT.batchSize);
            const estimatedTimeRemaining = Math.round((remainingBatches * RATE_LIMIT.delayBetweenBatches) / 1000);
            console.log(`  ⏳ Waiting 5s before next batch... (~${estimatedTimeRemaining}s remaining for this feed)`);
            await sleep(RATE_LIMIT.delayBetweenBatches);
          }
          
        } catch (batchError) {
          console.error(`  ❌ Batch ${batchNum} error:`, batchError.message);
          errors += batch.length;
        }
      }
      
      // Update feed last_fetched timestamp
      if (!dryRun) {
        await supabase
          .from('rss_feeds')
          .update({ last_fetched: new Date().toISOString() })
          .eq('feed_url', feedConfig.feed_url);
      }
      
      const feedResult = {
        feed_name: feedConfig.feed_name,
        total_episodes: items.length,
        new_episodes: newEpisodes,
        duplicates: duplicates,
        errors: errors
      };
      
      results.feedResults.push(feedResult);
      results.totalProcessed += items.length;
      results.totalNew += newEpisodes;
      results.totalDuplicates += duplicates;
      results.totalErrors += errors;
      
      console.log(`✅ ${feedConfig.feed_name} complete: ${newEpisodes} new, ${duplicates} duplicates, ${errors} errors`);
      console.log('');
      
      // Respectful delay before next feed
      if (feedConfig !== HISTORICAL_FEEDS[HISTORICAL_FEEDS.length - 1]) {
        console.log(`⏳ Waiting ${RATE_LIMIT.delayBetweenRequests * 2}ms before next feed...`);
        await sleep(RATE_LIMIT.delayBetweenRequests * 2);
      }
      
    } catch (feedError) {
      console.error(`❌ Fatal error processing ${feedConfig.feed_name}:`, feedError.message);
      results.feedResults.push({
        feed_name: feedConfig.feed_name,
        error: feedError.message
      });
      results.totalErrors += 1;
    }
  }
  
  const duration = (Date.now() - startTime) / 1000;
  
  console.log('🏆 Historical Sync Complete!');
  console.log(`⏱️ Total time: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
  console.log(`📊 Summary: ${results.totalNew} new, ${results.totalDuplicates} duplicates, ${results.totalErrors} errors`);
  console.log('📋 Feed Details:');
  
  results.feedResults.forEach(feed => {
    if (feed.error) {
      console.log(`  ❌ ${feed.feed_name}: ERROR - ${feed.error}`);
    } else {
      console.log(`  ✅ ${feed.feed_name}: ${feed.new_episodes}/${feed.total_episodes} new episodes`);
    }
  });
  
  return results;
}

// For manual execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dryRun = process.argv.includes('--dry-run');
  
  if (dryRun) {
    console.log('🧪 Running in DRY RUN mode - no database changes will be made');
  }
  
  historicalPodcastSync(dryRun)
    .then(results => {
      console.log('\n✅ Historical sync completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Historical sync failed:', error);
      process.exit(1);
    });
}

export { historicalPodcastSync };
