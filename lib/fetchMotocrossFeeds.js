// lib/fetchMotocrossFeeds.js - COMPLETE PRODUCTION VERSION WITH ALL ORIGINAL FEATURES
import Parser from 'rss-parser';
import { supabase } from './supabaseClient.js';

const parser = new Parser({
  customFields: {
    feed: ['image', 'itunes:image'],
    item: [
      ['description', 'description'],  // Ensure description is parsed
      'dc:creator', 
      'author', 
      'media:thumbnail', 
      'media:content',
      ['media:content', 'media:content', {keepArray: false}],
      'content:encoded', 
      'enclosure',
      'itunes:image'
    ]
  },
  defaultRSS: 2.0  // Ensure proper RSS 2.0 parsing
});

// Complete scoreImage helper function
function scoreImage(fullTag, url) {
  let score = 0;
  const urlLower = url.toLowerCase();
  
  // Negative indicators - things that suggest this isn't a main article image
  if (urlLower.includes('favicon')) score -= 1000;
  if (urlLower.includes('icon')) score -= 500;
  if (urlLower.includes('logo')) score -= 300;
  if (urlLower.includes('badge')) score -= 300;
  if (urlLower.includes('avatar')) score -= 300;
  if (urlLower.includes('banner') && !urlLower.includes('article')) score -= 200;
  if (urlLower.includes('advertisement') || urlLower.includes('sponsor')) score -= 500;
  
  // Ad banner image dimensions commonly used by moto sites (MX Vice, others)
  if (urlLower.match(/[\-_]980x250[\-_.]/)) score -= 900;
  if (urlLower.match(/[\-_]1476x200[\-_.]/)) score -= 900;
  if (urlLower.match(/[\-_]728x90[\-_.]/)) score -= 900;
  if (urlLower.match(/[\-_]300x250[\-_.]/)) score -= 900;
  
  // Penci theme ad boxes (MX Vice uses penci WordPress theme)
  if (fullTag.includes('penci-banner') || fullTag.includes('penci-promo') || fullTag.includes('penci-lazy')) score -= 900;
  if (urlLower.includes('button')) score -= 400;
  if (urlLower.includes('widget')) score -= 400;
  if (urlLower.includes('tracking') || urlLower.includes('pixel')) score -= 1000;
  if (urlLower.includes('spacer') || urlLower.includes('blank') || urlLower.includes('clear')) score -= 800;
  if (urlLower.includes('transparent')) score -= 800;
  
  // Social media icons
  if (urlLower.match(/facebook|twitter|instagram|youtube|linkedin|pinterest/)) score -= 400;
  
  // Newsletter/subscription related
  if (urlLower.includes('newsletter') || urlLower.includes('subscribe')) score -= 300;
  if (urlLower.includes('email') || urlLower.includes('rss')) score -= 300;
  
  // Common icon/small image sizes
  if (urlLower.match(/[\-_\/](1x1|16x16|32x32|48x48|64x64|88x31|80x15)[\-_\.]/)) score -= 1000;
  
  // Thumbnail indicators (but -scaled is okay, WordPress uses this for full images)
  if (urlLower.match(/[\-_](thumb|thumbnail|tiny|mini|small|xs)[\-_\.\d]/i) && !urlLower.includes('-scaled')) {
    score -= 200;
  }
  
  // Data URIs
  if (url.startsWith('data:')) score -= 1000;
  
  // Positive indicators - things that suggest this IS a main article image
  if (url.includes('wp-content/uploads/')) score += 50; // WordPress content
  if (url.includes('/content/') || url.includes('/images/')) score += 30;
  if (url.includes('/media/') || url.includes('/assets/')) score += 30;
  if (url.includes('/files/') || url.includes('/photos/')) score += 20;
  
  // Date patterns in URL (suggests article-specific image)
  if (url.match(/\/20\d{2}\/\d{2}\//)) score += 40; // Year/month pattern
  
  // Check img tag attributes for positive indicators
  if (fullTag.includes('class="wp-post-image"')) score += 100; // WordPress featured image
  if (fullTag.includes('featured')) score += 80;
  if (fullTag.includes('attachment-')) score += 60; // WordPress attachment
  if (fullTag.includes('size-')) score += 40; // Has size class
  if (fullTag.includes('aligncenter') || fullTag.includes('alignnone')) score += 20;
  
  // Article-specific classes
  if (fullTag.match(/class="[^"]*article/i)) score += 50;
  if (fullTag.match(/class="[^"]*content/i)) score += 30;
  if (fullTag.match(/class="[^"]*post/i)) score += 40;
  
  // Alt text suggesting article content
  if (fullTag.includes('alt=') && !fullTag.match(/alt=["'][^"']*(?:logo|icon|banner|avatar)/i)) {
    score += 20;
  }
  
  return score;
}

async function fetchMotocrossFeeds(dateParam = false) {
  const startTime = Date.now();
  let totalProcessed = 0;
  let skippedFeeds = 0;
  
  try {
    console.log('🏁 Starting motocross feed fetch...');
    
    // Determine date range based on parameter
    let startDate, endDate;
    let testMode = false;
    
    if (dateParam) {
      // Test mode - fetch historical data
      testMode = true;
      
      // Check if it's a "days" parameter (e.g., "days:10")
      if (typeof dateParam === 'string' && dateParam.startsWith('days:')) {
        const days = parseInt(dateParam.split(':')[1]);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        console.log(`📅 Fetching ${days} days of history: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      } else {
        // Single date (existing functionality)
        startDate = new Date(dateParam);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(dateParam);
        endDate.setHours(23, 59, 59, 999);
        console.log(`📅 Test mode: fetching articles for ${dateParam}`);
      }
    } else {
      // Normal mode - today only
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      console.log('🔄 Normal mode: fetching today\'s articles');
    }
    
    const { data: feeds, error: feedError } = await supabase
      .from('motocross_feeds')
      .select('*')
      .eq('is_active', true);
    
    if (feedError) throw feedError;
    
    console.log(`🔍 Checking ${feeds.length} feeds...`);
    
    for (const feedConfig of feeds) {
      try {
        // In test mode, skip ETag checks to ensure we get all data
        const headers = { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        
        if (!testMode && feedConfig.last_etag) {
          headers['If-None-Match'] = feedConfig.last_etag;
        }
        if (!testMode && feedConfig.last_modified) {
          headers['If-Modified-Since'] = feedConfig.last_modified;
        }
        
        const response = await fetch(feedConfig.feed_url, { headers });
        
        if (!testMode && response.status === 304) {
          console.log(`⏭️  ${feedConfig.company_name}: No changes`);
          skippedFeeds++;
          continue;
        }
        
        if (!response.ok) {
          console.error(`❌ ${feedConfig.company_name}: HTTP ${response.status}`);
          continue;
        }
        
        console.log(`📥 ${feedConfig.company_name}: Processing${testMode ? ' (test mode)' : ''}...`);
        
        // Store new headers only in normal mode
        if (!testMode) {
          const etag = response.headers.get('etag');
          const lastModified = response.headers.get('last-modified');
          
          if (etag || lastModified) {
            await supabase
              .from('motocross_feeds')
              .update({ last_etag: etag, last_modified: lastModified })
              .eq('id', feedConfig.id);
          }
        }
        
        // Parse feed
        const feedText = await response.text();
        const feed = await parser.parseString(feedText);
        const items = feed.items || [];
        
        let newArticles = 0;
        let duplicates = 0;
        let outOfRange = 0;
        
        for (const item of items) {
          try {
            const itemDate = new Date(item.pubDate);
            
            // Check if article is within our date range
            if (itemDate < startDate || itemDate > endDate) {
              outOfRange++;
              continue;
            }
            
            // Check if exists
            const guid = item.guid || item.link || `${feedConfig.feed_url}-${item.title}`;
            
            const { data: existing } = await supabase
              .from('articles')
              .select('id')
              .eq('guid', guid)
              .single();
            
            if (existing) {
              duplicates++;
              // In test mode, continue checking older articles
              // In normal mode, stop at first duplicate
              if (!testMode) {
                console.log(`📌 ${feedConfig.company_name}: Hit existing content, stopping`);
                break;
              }
              continue;
            }
            
            // COMPREHENSIVE IMAGE EXTRACTION STRATEGY
            const articleUrl = item.link || '';
            let imageUrl = '';  // Start with empty string
            let imageSource = '';
            
            // Returns true only for URLs that are clearly image files or declared as image medium
            const isImageUrl = (url) => /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i.test(url);

            // Priority 1: Standard RSS media fields (most reliable when present)
            if (item['media:content']) {
              // Normalize to array — feeds like MXA emit multiple <media:content> elements
              // (first is often a video embed, subsequent ones are medium="image" photos)
              const mcItems = Array.isArray(item['media:content'])
                ? item['media:content']
                : [item['media:content']];

              // Helper to extract url + medium from one media:content node
              const getMcUrlAndMedium = (mc) => {
                if (typeof mc === 'string') return { url: mc, medium: '' };
                const url = (mc.$ && mc.$.url) || mc.url || '';
                const medium = (mc.$ && mc.$.medium) || mc.medium || '';
                return { url, medium };
              };

              // Prefer the first element explicitly declared as medium="image"
              // Fall back to any element whose URL looks like an image file
              let chosen = mcItems.find(mc => getMcUrlAndMedium(mc).medium === 'image');
              if (!chosen) {
                chosen = mcItems.find(mc => isImageUrl(getMcUrlAndMedium(mc).url));
              }

              if (chosen) {
                const { url: mcUrl } = getMcUrlAndMedium(chosen);
                if (mcUrl) {
                  imageUrl = mcUrl;
                  imageSource = 'media:content';
                }
              }
            } 
            else if (item['media:thumbnail']) {
              // Similar handling for media:thumbnail
              if (typeof item['media:thumbnail'] === 'object') {
                if (item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
                  imageUrl = item['media:thumbnail'].$.url;
                  imageSource = 'media:thumbnail';
                } else if (item['media:thumbnail'].url) {
                  imageUrl = item['media:thumbnail'].url;
                  imageSource = 'media:thumbnail';
                }
              } else if (typeof item['media:thumbnail'] === 'string') {
                imageUrl = item['media:thumbnail'];
                imageSource = 'media:thumbnail';
              }
            } 
            else if (item['itunes:image']) {
              // iTunes image can also be object or string
              if (typeof item['itunes:image'] === 'object' && item['itunes:image'].href) {
                imageUrl = item['itunes:image'].href;
                imageSource = 'itunes:image';
              } else if (typeof item['itunes:image'] === 'string') {
                imageUrl = item['itunes:image'];
                imageSource = 'itunes:image';
              }
            } 
            else if (item.enclosure) {
              // Enclosure handling
              if (item.enclosure.type && item.enclosure.type.includes('image')) {
                imageUrl = item.enclosure.url;
                imageSource = 'enclosure';
              } else if (Array.isArray(item.enclosure)) {
                // Sometimes enclosure is an array
                const imageEnclosure = item.enclosure.find(e => e.type && e.type.includes('image'));
                if (imageEnclosure) {
                  imageUrl = imageEnclosure.url;
                  imageSource = 'enclosure';
                }
              }
            }
            
            // Helper: returns true for URLs that should never be used as an article image
            const shouldSkipImage = (url) => {
              const urlLower = url.toLowerCase();
              
              const skipPatterns = [
                'favicon', 'fav-', 'fav.', '/favicon',
                'icon-', '/icon', 'icons/', '.ico',
                'logo', 'badge', 'avatar', 
                'banner', 'advertisement', 'sponsor', 
                'button', 'widget', 'tracking', 'pixel',
                'spacer', 'blank', 'clear', 'transparent',
                'share', 'social', 'facebook', 'twitter', 'instagram', 'youtube',
                'newsletter', 'subscribe', 'email', 'rss',
                '1x1', '16x16', '32x32', '48x48', '64x64', '88x31', '80x15',
                's.w.org/images/core/emoji',
                'tld-', 'troy-lee', 'troyleedesigns',
                '980x250', '728x90', '300x250', '1476x200',
                '_banner', '-banner', '/banner',
                'wolf.jpg', 'moto-master', 'brake',
                '-ad-', '_ad_', '/ad/', '-ls-',
                'sponsor', 'promo',
                'cropped-simple-professional',
                '-32x32', '-150x150'
              ];
              
              for (const pattern of skipPatterns) {
                if (urlLower.includes(pattern)) return true;
              }
              
              if (url.startsWith('data:')) return true;
              
              if (urlLower.match(/[-_](thumb|thumbnail|tiny|mini|small|xs)[-_.\d]/i) && !urlLower.includes('-scaled')) {
                return true;
              }
              
              return false;
            };

            // Priority 2: Extract from description/content HTML (when RSS fields aren't available)
            // SMART LOGIC: First substantial image is usually the article's main image
            if (!imageUrl) {
              // Check description FIRST (usually has the main image), then content:encoded
              const description = item.description || '';
              const contentEncoded = item['content:encoded'] || '';
              
              // Strategy A: Find FIRST valid image in description
              if (description) {
                // Extract ALL images from description
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                let match;
                
                while ((match = imgRegex.exec(description)) !== null) {
                  const fullImgTag = match[0];
                  const candidateUrl = match[1];
                  
                  // Skip images with ad-related classes (MX Vice specific)
                  if (fullImgTag.includes('penci-banner') || 
                      fullImgTag.includes('penci-promo') ||
                      fullImgTag.includes('class="penci-lazy')) {
                    continue;
                  }
                  
                  // Check if this is a valid article image
                  if (!shouldSkipImage(candidateUrl)) {
                    // This is likely our main image!
                    imageUrl = candidateUrl;
                    imageSource = 'description-first-image';
                    
                    // Extra confidence if it has markers of being a content image
                    if (candidateUrl.includes('wp-content/uploads/') ||
                        candidateUrl.includes('/content/') ||
                        candidateUrl.includes('/images/') ||
                        candidateUrl.includes('/media/') ||
                        candidateUrl.includes('/assets/') ||
                        candidateUrl.includes('/files/') ||
                        candidateUrl.includes('/photos/') ||
                        candidateUrl.match(/\/20\d{2}\/\d{2}\//)) {
                      imageSource = 'description-content-image';
                    }
                    
                    break;
                  }
                }
              }
              
              // Strategy B: If no valid image in description, check content:encoded with scoring
              if (!imageUrl && contentEncoded) {
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                const candidates = [];
                let match;
                
                while ((match = imgRegex.exec(contentEncoded)) !== null) {
                  const fullTag = match[0];
                  const url = match[1];
                  
                  // Skip penci theme ad banners (MX Vice and other penci WordPress sites)
                  if (fullTag.includes('penci-banner') || fullTag.includes('penci-promo') || fullTag.includes('penci-lazy')) {
                    continue;
                  }
                  
                  const score = scoreImage(fullTag, url);
                  
                  if (score > -1000) {
                    candidates.push({ url, score, source: 'content' });
                  }
                }
                
                if (candidates.length > 0) {
                  candidates.sort((a, b) => b.score - a.score);
                  imageUrl = candidates[0].url;
                  imageSource = candidates[0].score > 50 ? 'content-main-image' : 'content-first-image';
                }
              }
              
              // Strategy C: If still no image, try looking for image URLs not in img tags
              if (!imageUrl) {
                const combinedContent = description + ' ' + contentEncoded;
                // Look for image URLs that might not be in img tags
                const urlPattern = /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi;
                let match;
                
                while ((match = urlPattern.exec(combinedContent)) !== null) {
                  const candidateUrl = match[0];
                  
                  if (!shouldSkipImage(candidateUrl)) {
                    imageUrl = candidateUrl;
                    imageSource = 'content-url-image';
                    break;
                  }
                }
              }

              // Strategy D: Extract YouTube thumbnail from embedded iframe
              // Covers video-only posts (MXA video posts, Swap Moto Live) that have no <img>
              if (!imageUrl) {
                const combinedContent = description + ' ' + contentEncoded;
                const iframeMatch = combinedContent.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/);
                if (iframeMatch) {
                  imageUrl = `https://img.youtube.com/vi/${iframeMatch[1]}/hqdefault.jpg`;
                  imageSource = 'youtube-iframe-thumbnail';
                }
              }
            }
            
            // Clean up any HTML entities in the URL
            if (imageUrl) {
              // If imageUrl is somehow an array, take the first element
              if (Array.isArray(imageUrl)) {
                console.log(`⚠️ imageUrl was an array! Converting to string.`);
                imageUrl = imageUrl[0] || '';
              }
              
              // Clean up HTML entities
              imageUrl = String(imageUrl).replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"');
              
              // Convert WordPress thumbnail URLs to full-size images
              // GateDrop and other WordPress sites use -150x150, -300x200, etc.
              imageUrl = imageUrl.replace(/-\d{2,4}x\d{2,4}\.(jpg|jpeg|png|webp)$/i, '.$1');

              // Strip Drupal image style prefix — only for sites that use public:// (not vitalmx.com,
              // whose styled CDN URLs are valid but bare S3 paths return 403)
              imageUrl = imageUrl.replace(/\/styles\/[^/]+\/public\//, '/files/');
              // Collapse any double-slashes in the path that the above may produce (not in protocol)
              imageUrl = imageUrl.replace(/([^:])\/\/+/g, '$1/');
              
              // Ensure absolute URL and HTTPS protocol
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else if (imageUrl.startsWith('/') && articleUrl) {
                // Relative URL - construct absolute
                try {
                  const baseUrl = new URL(articleUrl);
                  imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
                } catch (e) {
                  // URL parsing failed, keep as is
                }
              } else if (imageUrl.startsWith('http://')) {
                // Convert http to https (many apps block mixed content)
                imageUrl = imageUrl.replace('http://', 'https://');
              }
              
              // Final check - ensure it's a string
              imageUrl = String(imageUrl);
            }
            
            // Last resort: Use feed image, but only if it passes the skip filter
            // (prevents 32x32 favicons/site logos from being stored as article images)
            if (!imageUrl && feed.image && feed.image.url) {
              const feedImg = Array.isArray(feed.image.url)
                ? String(feed.image.url[0] || '')
                : String(feed.image.url);
              if (feedImg && !shouldSkipImage(feedImg)) {
                imageUrl = feedImg;
                imageSource = 'feed-logo-fallback';
              }
            }
            
            // Clean up the excerpt - remove HTML tags and decode entities
            let excerpt = item.description || item['content:encoded'] || '';
            // Remove img tags first to avoid including image URLs in excerpt
            excerpt = excerpt.replace(/<img[^>]*>/gi, '');
            // Remove all other HTML tags
            excerpt = excerpt.replace(/<[^>]*>/g, '');
            // Decode common HTML entities
            excerpt = excerpt.replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#039;/g, "'")
                            .replace(/&#8217;/g, "'")
                            .replace(/&#8216;/g, "'")
                            .replace(/&#8220;/g, '"')
                            .replace(/&#8221;/g, '"')
                            .replace(/&#8230;/g, '...')
                            .replace(/&#248;/g, 'ø')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' '); // Collapse multiple spaces
            // Trim and limit length
            excerpt = excerpt.trim().substring(0, 200);
            
            // Store new article
            const articleData = {
              title: (item.title || 'Untitled').substring(0, 300),
              published_date: itemDate.toISOString(),
              image_url: imageUrl || '', // Ensure it's a string, not an array
              author: item['dc:creator'] || item.author || 'Staff Writer',
              excerpt: excerpt,
              article_url: articleUrl,
              company: feedConfig.company_name,
              feed_url: feedConfig.feed_url,
              guid: guid
            };
            
            const { error: insertError } = await supabase
              .from('articles')
              .insert(articleData);
            
            if (insertError) {
              console.error(`❌ Insert failed for "${item.title?.substring(0, 40)}": ${insertError.message}`);
            } else {
              newArticles++;
              totalProcessed++;
              
              // Enhanced logging in test mode
              if (testMode && imageUrl) {
                const imageInfo = imageSource === 'feed-logo-fallback' 
                  ? '⚠️  Using feed logo (no article image found)'
                  : `✅ Image from: ${imageSource}`;
                console.log(`   ${imageInfo} for "${item.title?.substring(0, 40)}..."`);
              } else if (testMode && !imageUrl) {
                console.log(`   ❌ No image found for "${item.title?.substring(0, 40)}..."`);
              }
            }
          } catch (itemError) {
            console.error(`❌ Error processing item:`, itemError.message);
            // Continue processing other items even if one fails
          }
        }
        
        // Update last fetched only in normal mode
        if (!testMode) {
          await supabase
            .from('motocross_feeds')
            .update({ last_fetched: new Date().toISOString() })
            .eq('id', feedConfig.id);
        }
        
        if (testMode) {
          console.log(`✅ ${feedConfig.company_name}: ${newArticles} new, ${duplicates} duplicates, ${outOfRange} out of range`);
        } else {
          console.log(`✅ ${feedConfig.company_name}: ${newArticles} new articles`);
        }
        
      } catch (error) {
        console.error(`❌ ${feedConfig.feed_name}:`, error.message);
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n🏆 Complete! ${totalProcessed} articles, ${skippedFeeds} feeds skipped in ${duration}s`);
    
    return { success: true, articlesProcessed: totalProcessed, feedsSkipped: skippedFeeds };
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  }
}

export { fetchMotocrossFeeds };
