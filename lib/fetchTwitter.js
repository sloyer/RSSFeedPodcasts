// lib/fetchTwitter.js - Twitter Scraper using Playwright (Nuclear Option)
import { supabase } from './supabaseClient.js';
import { chromium } from 'playwright-chromium';

function randomDelay(min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Fetch tweets using Playwright (heavy but works)
async function fetchTweetsFromUser(username, count = 20) {
  let browser;
  try {
    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to user's Twitter page
    await page.goto(`https://x.com/${username}`, { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    // Wait a bit for tweets to load
    await page.waitForTimeout(3000);
    
    // Extract tweets from the page
    const tweets = await page.evaluate((username, count) => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];
      
      for (let i = 0; i < Math.min(articles.length, count); i++) {
        const article = articles[i];
        
        try {
          // Extract tweet text
          const textElement = article.querySelector('[data-testid="tweetText"]');
          const text = textElement ? textElement.innerText : '';
          
          // Extract tweet link to get ID
          const linkElement = article.querySelector('a[href*="/status/"]');
          const href = linkElement ? linkElement.getAttribute('href') : '';
          const tweetId = href.match(/\/status\/(\d+)/)?.[1] || '';
          
          // Extract time
          const timeElement = article.querySelector('time');
          const datetime = timeElement ? timeElement.getAttribute('datetime') : '';
          
          // Extract author info
          const authorLink = article.querySelector('a[role="link"]');
          const authorImg = article.querySelector('img[alt]');
          const authorName = authorImg ? authorImg.getAttribute('alt') : '';
          const authorAvatar = authorImg ? authorImg.getAttribute('src') : '';
          
          if (tweetId && text) {
            results.push({
              twitter_id: tweetId,
              account_username: username,
              text: text,
              author_name: authorName || username,
              author_avatar: authorAvatar || '',
              posted_at: datetime || new Date().toISOString(),
              tweet_url: `https://x.com${href}`
            });
          }
        } catch (e) {
          // Skip this tweet if parsing fails
          continue;
        }
      }
      
      return results;
    }, username, count);
    
    await browser.close();
    return tweets;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error(`  ❌ Error scraping @${username}:`, error.message);
    return [];
  }
}

// Main function to fetch Twitter feeds
async function fetchTwitterFeeds(daysBack = 3) {
  const startTime = Date.now();
  let totalTweets = 0;
  let processedAccounts = 0;
  
  try {
    console.log(`🐦 Starting Twitter fetch (${daysBack} days)...`);
    
    // Get active Twitter accounts
    const { data: accounts, error: accountError } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('is_active', true);
    
    if (accountError) throw accountError;
    
    console.log(`📊 Processing ${accounts.length} Twitter accounts...`);
    
    // Calculate cutoff date for tweets
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    // Process each account with delays
    for (const account of accounts) {
      try {
        console.log(`📥 Checking @${account.username}...`);
        
        // Add random delay between accounts (stealth)
        await randomDelay(500, 2000);
        
        // Fetch tweets using rettiwt-api
        const tweets = await fetchTweetsFromUser(account.username, 20);
        
        if (tweets.length === 0) {
          console.log(`  No tweets found`);
          continue;
        }
        
        // Filter to only tweets within date range
        const recentTweets = tweets.filter(tweet => {
          const tweetDate = new Date(tweet.posted_at);
          return tweetDate >= cutoffDate;
        });
        
        if (recentTweets.length === 0) {
          console.log(`  No recent tweets (all older than ${daysBack} days)`);
          continue;
        }
        
        console.log(`  Found ${recentTweets.length} recent tweets`);
        
        // Store tweets in database
        const { error: insertError } = await supabase
          .from('tweets')
          .upsert(recentTweets, {
            onConflict: 'twitter_id',
            ignoreDuplicates: false
          });
        
        if (insertError) {
          console.error(`  Error inserting tweets:`, insertError);
        } else {
          totalTweets += recentTweets.length;
          
          // Update account's last fetch time
          await supabase
            .from('twitter_accounts')
            .update({ last_fetched: new Date().toISOString() })
            .eq('username', account.username);
        }
        
        processedAccounts++;
        
      } catch (error) {
        console.error(`❌ Error processing @${account.username}: ${error.message}`);
      }
    }
    
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
    console.log(`\n✅ Twitter fetch complete: ${totalTweets} new tweets from ${processedAccounts} accounts in ${duration}s`);
    
    return {
      success: true,
      tweetsAdded: totalTweets,
      accountsProcessed: processedAccounts
    };
    
  } catch (error) {
    console.error('💥 Fatal error in Twitter fetch:', error);
    return { success: false, error: error.message };
  }
}

export { fetchTwitterFeeds };

