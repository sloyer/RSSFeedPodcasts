// lib/fetchTwitter.js - Playwright Twitter Scraper (Last Resort)
import { supabase } from './supabaseClient.js';
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';

const TWITTER_LIST_ID = '2000142633893789982';

function randomDelay(min = 500, max = 2000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Scrape tweets from a single user's profile using Playwright
async function scrapeTweetsFromUser(browser, context, username, maxTweets = 5) {
  let page;
  try {
    page = await context.newPage();
    
    console.log(`  🌐 Scraping @${username}...`);
    
    // Navigate to user's profile
    await page.goto(`https://x.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    
    // Wait for tweets to load (reduced for speed)
    await page.waitForTimeout(2000);
    
    // Extract tweets
    const tweets = await page.evaluate((username) => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];
      
      for (let i = 0; i < Math.min(articles.length, 5); i++) {
        const article = articles[i];
        
        try {
          // Extract text
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          // Extract tweet ID from link
          const linkEl = article.querySelector('a[href*="/status/"]');
          const href = linkEl ? linkEl.getAttribute('href') : '';
          const tweetId = href.match(/\/status\/(\d+)/)?.[1] || '';
          
          // Extract time
          const timeEl = article.querySelector('time');
          const datetime = timeEl ? timeEl.getAttribute('datetime') : '';
          
          // Extract author info
          const authorImg = article.querySelector('img[alt][src*="profile"]');
          const authorName = authorImg ? authorImg.getAttribute('alt') : username;
          const authorAvatar = authorImg ? authorImg.getAttribute('src') : '';
          
          if (tweetId && text) {
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
          // Skip if parsing fails
        }
      }
      
      return results;
    }, username);
    
    await page.close();
    console.log(`  ✅ Found ${tweets.length} tweets from @${username}`);
    return tweets;
    
  } catch (error) {
    if (page) await page.close();
    console.error(`  ❌ Error scraping @${username}:`, error.message);
    return [];
  }
}

// Scrape tweets from all accounts individually
async function scrapeAllAccounts() {
  let browser;
  try {
    console.log('🚀 Launching browser...');
    
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    // Get accounts from database
    const { data: accounts } = await supabase
      .from('twitter_accounts')
      .select('username')
      .eq('is_active', true);
    
    if (!accounts || accounts.length === 0) {
      await browser.close();
      return [];
    }
    
    console.log(`📊 Scraping ${accounts.length} accounts...`);
    
    let allTweets = [];
    
    // Scrape each account (with minimal delays for speed)
    for (const account of accounts) {
      await randomDelay(500, 1000); // Shorter delay for speed
      const tweets = await scrapeTweetsFromUser(browser, context, account.username, 3); // Only 3 tweets per account
      allTweets = allTweets.concat(tweets);
    }
    
    await browser.close();
    console.log(`✅ Scraped total of ${allTweets.length} tweets from ${accounts.length} accounts`);
    return allTweets;
    
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
    console.log(`🐦 Starting Twitter scrape (${daysBack} days)...`);
    
    // Scrape tweets from each account individually (public profiles don't need login)
    const tweets = await scrapeAllAccounts();
    
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

