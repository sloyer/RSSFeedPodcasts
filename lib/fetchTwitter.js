// lib/fetchTwitter.js - Playwright Twitter Scraper (Last Resort)
import { supabase } from './supabaseClient.js';
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';

const TWITTER_LIST_ID = '2000142633893789982';

function randomDelay(min = 500, max = 2000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Scrape tweets from list using Playwright
async function scrapeListTweets() {
  let browser;
  try {
    console.log('🚀 Launching browser...');
    
    // Launch Chromium
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    console.log(`🌐 Navigating to list...`);
    
    // Navigate to the list page
    await page.goto(`https://x.com/i/lists/${TWITTER_LIST_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Wait for tweets to load
    await page.waitForTimeout(5000);
    
    // Check what's on the page
    const pageTitle = await page.title();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`📄 Page title: ${pageTitle}`);
    console.log(`📄 Page content preview: ${pageText.substring(0, 100)}...`);
    
    console.log('📄 Extracting tweets from page...');
    
    // Extract tweets
    const tweets = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      console.log(`Found ${articles.length} article elements`);
      const results = [];
      
      articles.forEach(article => {
        try {
          // Extract text
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          // Extract author
          const userLink = article.querySelector('a[href^="/"][href*="/status/"]');
          const href = userLink ? userLink.getAttribute('href') : '';
          const match = href.match(/^\/([^\/]+)\/status\/(\d+)/);
          const username = match ? match[1] : '';
          const tweetId = match ? match[2] : '';
          
          // Extract time
          const timeEl = article.querySelector('time');
          const datetime = timeEl ? timeEl.getAttribute('datetime') : '';
          
          // Extract author info
          const authorImg = article.querySelector('img[alt][src*="profile"]');
          const authorName = authorImg ? authorImg.getAttribute('alt') : username;
          const authorAvatar = authorImg ? authorImg.getAttribute('src') : '';
          
          if (tweetId && text && username) {
            results.push({
              twitter_id: tweetId,
              account_username: username,
              text: text,
              author_name: authorName,
              author_avatar: authorAvatar,
              posted_at: datetime || new Date().toISOString(),
              tweet_url: `https://x.com/${username}/status/${tweetId}`
            });
          }
        } catch (e) {
          // Skip failed tweet
        }
      });
      
      return results;
    });
    
    await browser.close();
    console.log(`✅ Scraped ${tweets.length} tweets from list`);
    return tweets;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error(`❌ Playwright error:`, error.message);
    return [];
  }
}

// Main function to fetch Twitter feeds from list
async function fetchTwitterFeeds(daysBack = 3) {
  const startTime = Date.now();
  let totalTweets = 0;
  
  try {
    console.log(`🐦 Starting Twitter list fetch (${daysBack} days)...`);
    
    // Scrape tweets from the list using Playwright
    const tweets = await scrapeListTweets();
    
    if (tweets.length === 0) {
      console.log('  No tweets found from list');
      return {
        success: true,
        tweetsAdded: 0,
        accountsProcessed: 0
      };
    }
    
    console.log(`📥 Found ${tweets.length} tweets from list`);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    // Filter to only recent tweets
    const recentTweets = tweets.filter(tweet => {
      const tweetDate = new Date(tweet.posted_at);
      return tweetDate >= cutoffDate;
    });
    
    if (recentTweets.length === 0) {
      console.log(`  No tweets within last ${daysBack} days`);
      return {
        success: true,
        tweetsAdded: 0,
        accountsProcessed: 0
      };
    }
    
    console.log(`✅ Found ${recentTweets.length} recent tweets (last ${daysBack} days)`);
    
    // Store tweets in database
    const { error: insertError } = await supabase
      .from('tweets')
      .upsert(recentTweets, {
        onConflict: 'twitter_id',
        ignoreDuplicates: false
      });
    
    if (insertError) {
      console.error(`❌ Error inserting tweets:`, insertError);
      throw insertError;
    }
    
    totalTweets = recentTweets.length;
    
    // Count unique accounts
    const uniqueAccounts = new Set(recentTweets.map(t => t.account_username));
    
    // Clean up old tweets (older than 3 days)
    const { error: deleteError } = await supabase
      .from('tweets')
      .delete()
      .lt('posted_at', cutoffDate.toISOString());
    
    if (deleteError) {
      console.error('❌ Error deleting old tweets:', deleteError);
    } else {
      console.log('🗑️  Cleaned up old tweets');
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Twitter fetch complete: ${totalTweets} new tweets from ${uniqueAccounts.size} accounts in ${duration}s`);
    
    return {
      success: true,
      tweetsAdded: totalTweets,
      accountsProcessed: uniqueAccounts.size
    };
    
  } catch (error) {
    console.error('💥 Fatal error in Twitter fetch:', error);
    return { success: false, error: error.message };
  }
}

export { fetchTwitterFeeds };

