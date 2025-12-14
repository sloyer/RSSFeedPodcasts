// lib/fetchTwitter.js - Lightweight Twitter Scraper (No Auth, Fragile)
import { supabase } from './supabaseClient.js';
import fetch from 'node-fetch';

// Rotating user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Fetch tweets using Twitter's syndication API (used for embeds, no auth needed)
async function fetchTweetsFromUser(username, count = 20) {
  try {
    // Twitter's syndication endpoint (unofficial but works for public profiles)
    const url = `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${username}&limit=${count}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json',
        'Referer': 'https://x.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.timeline || !data.timeline.entries) {
      return [];
    }
    
    // Parse tweets from syndication API response
    const tweets = data.timeline.entries
      .filter(entry => entry.tweet) // Only tweet entries
      .map(entry => {
        const tweet = entry.tweet;
        return {
          twitter_id: tweet.id_str,
          account_username: username,
          text: tweet.text || '',
          author_name: tweet.user?.name || username,
          author_avatar: tweet.user?.profile_image_url_https || '',
          posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
          tweet_url: `https://x.com/${username}/status/${tweet.id_str}`
        };
      });
    
    return tweets;
    
  } catch (error) {
    console.error(`  ❌ Error fetching @${username}:`, error.message);
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

