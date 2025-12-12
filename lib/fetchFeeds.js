// fetchFeeds.js - RSS Fetcher Script
import Parser from 'rss-parser';
import { supabase } from './supabaseClient.js';

const parser = new Parser({
  customFields: {
    feed: ['image', 'itunes:image'],
    item: ['itunes:image', 'enclosure']
  }
});

async function fetchAndStoreFeeds(forceFullSync = false) {
  const startTime = Date.now();
  try {
    console.log('Starting RSS feed fetch...');
    
    // Get active RSS feeds from database
    const { data: feeds, error: feedError } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('is_active', true);
    
    if (feedError) {
      console.error('Error fetching feed list:', feedError);
      return;
    }
    
    console.log(`Processing ${feeds.length} feeds...`);
    
    for (const feedConfig of feeds) {
      try {
        // Check if we should bypass ETag (if last fetch > 12 hours ago)
        const shouldBypassETag = feedConfig.last_fetched 
          ? (Date.now() - new Date(feedConfig.last_fetched).getTime()) > (12 * 60 * 60 * 1000)
          : true; // Always fetch if never fetched before
        
        if (shouldBypassETag) {
          console.log(`Fetching: ${feedConfig.feed_name} (forcing refresh, last fetch > 12h)`);
        } else {
          console.log(`Fetching: ${feedConfig.feed_name}`);
        }
        
        // Fetch with custom headers to control ETag behavior
        const headers = { 'User-Agent': 'RSS Aggregator/1.0' };
        
        // Only include ETag headers if we're NOT bypassing and they exist
        if (!shouldBypassETag) {
          if (feedConfig.last_etag) headers['If-None-Match'] = feedConfig.last_etag;
          if (feedConfig.last_modified) headers['If-Modified-Since'] = feedConfig.last_modified;
        }
        
        const response = await fetch(feedConfig.feed_url, { headers });
        
        // Check for 304 Not Modified (only if we sent ETag headers)
        if (!shouldBypassETag && response.status === 304) {
          console.log(`  No changes (304)`);
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        // Store new ETag headers
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        if (etag || lastModified) {
          await supabase
            .from('rss_feeds')
            .update({ last_etag: etag, last_modified: lastModified })
            .eq('id', feedConfig.id);
        }
        
        // Parse the feed
        const feedText = await response.text();
        const feedPromise = parser.parseString(feedText);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Feed fetch timeout')), 15000)
        );
        
        const feed = await Promise.race([feedPromise, timeoutPromise]);
        
        // Process items in smaller batches to avoid memory issues
        const batchSize = 10;
        const items = feed.items || [];
        let processedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchData = [];
          
          for (const item of batch) {
            // Check if episode is from 2025 or later
            const episodeDate = item.pubDate ? new Date(item.pubDate) : new Date();
            const year2025 = new Date('2025-01-01');
            
            // Skip episodes older than 2025
            if (episodeDate < year2025) {
              skippedCount++;
              continue;
            }
            
            // Extract audio URL from enclosure
            let audioUrl = '';
            if (item.enclosure && item.enclosure.url) {
              audioUrl = item.enclosure.url;
            }
            // Fallback: check if enclosure is an array (some RSS feeds format it differently)
            else if (Array.isArray(item.enclosure) && item.enclosure[0] && item.enclosure[0].url) {
              audioUrl = item.enclosure[0].url;
            }
            // Additional fallback: check for audio files in other fields
            else if (item.link && item.link.includes('.mp3')) {
              audioUrl = item.link;
            }
            
            // Extract image URL
            let imageUrl = item['itunes:image'] || 
                          feed.image?.url || 
                          feed['itunes:image']?.href ||
                          '';
            
            // Convert http to https for images
            if (imageUrl && imageUrl.startsWith('http://')) {
              imageUrl = imageUrl.replace('http://', 'https://');
            }
            
            // Convert http to https for audio URLs
            if (audioUrl && audioUrl.startsWith('http://')) {
              audioUrl = audioUrl.replace('http://', 'https://');
            }
            
            const podcastData = {
              feed_url: feedConfig.feed_url,
              podcast_name: feed.title || feedConfig.feed_name,
              podcast_title: item.title || 'Untitled',
              podcast_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
              podcast_description: item.contentSnippet || item.content || '',
              podcast_image: imageUrl,
              audio_url: audioUrl,
              guid: item.guid || item.link || `${feedConfig.feed_url}-${item.title}-${item.pubDate}`
            };
            
            batchData.push(podcastData);
          }
          
          // Batch insert/upsert
          if (batchData.length > 0) {
            const { error: insertError } = await supabase
              .from('podcasts')
              .upsert(batchData, {
                onConflict: 'guid',
                ignoreDuplicates: false
              });
            
            if (insertError) {
              console.error(`Error inserting batch for ${feedConfig.feed_name}:`, insertError);
            } else {
              processedCount += batchData.length;
            }
          }
        }
        
        // Update last fetched timestamp
        await supabase
          .from('rss_feeds')
          .update({ last_fetched: new Date().toISOString() })
          .eq('id', feedConfig.id);
        
        console.log(`Successfully processed ${processedCount} items (skipped ${skippedCount} pre-2025) from ${feedConfig.feed_name}`);
        
      } catch (parseError) {
        console.error(`Error parsing feed ${feedConfig.feed_name}:`, parseError.message);
        // Continue with other feeds even if one fails
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Feed fetch completed successfully in ${duration}s`);
    
  } catch (error) {
    console.error('Fatal error in fetchAndStoreFeeds:', error);
    throw error;
  }
}

// For manual execution or testing
if (process.argv[1] === new URL(import.meta.url).pathname) {
  fetchAndStoreFeeds();
}

export { fetchAndStoreFeeds };