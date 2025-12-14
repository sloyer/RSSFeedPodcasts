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
        console.log(`Fetching: ${feedConfig.feed_name}`);
        
        // Add timeout to RSS parsing
        const feedPromise = parser.parseURL(feedConfig.feed_url);
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
            
            // Extract image URL (handle objects/arrays/strings safely)
            let imageUrl = '';
            
            // Try item['itunes:image'] first
            if (item['itunes:image']) {
              if (typeof item['itunes:image'] === 'string') {
                imageUrl = item['itunes:image'];
              } else if (item['itunes:image'].$?.href) {
                imageUrl = item['itunes:image'].$.href;
              } else if (item['itunes:image'].href) {
                imageUrl = item['itunes:image'].href;
              }
            }
            
            // Fall back to feed image
            if (!imageUrl && feed.image?.url) {
              if (Array.isArray(feed.image.url)) {
                imageUrl = feed.image.url[0] || '';
              } else {
                imageUrl = feed.image.url;
              }
            }
            
            // Fall back to feed itunes:image
            if (!imageUrl && feed['itunes:image']) {
              if (typeof feed['itunes:image'] === 'string') {
                imageUrl = feed['itunes:image'];
              } else if (feed['itunes:image'].$?.href) {
                imageUrl = feed['itunes:image'].$.href;
              } else if (feed['itunes:image'].href) {
                imageUrl = feed['itunes:image'].href;
              }
            }
            
            // Ensure imageUrl is always a clean string
            imageUrl = String(imageUrl || '').trim();
            
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