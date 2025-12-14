// lib/fetchTwitter.js - Twitter Feed Fetcher using rettiwt-api
import { supabase } from './supabaseClient.js';
import { Rettiwt } from 'rettiwt-api';

// Initialize rettiwt (no API key needed)
const rettiwt = new Rettiwt();

// Random delay to avoid detection
function randomDelay(min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Fetch tweets from a Twitter user using rettiwt-api
async function fetchTweetsFromUser(username, count = 20) {
  try {
    // Use rettiwt to get user timeline
    const timeline = await rettiwt.tweet.timeline(username, count);
    
    if (!timeline || !timeline.list || timeline.list.length === 0) {
      return [];
    }
    
    // Convert to our format
    const tweets = timeline.list.map(tweet => ({
      twitter_id: tweet.id,
      account_username: username,
      text: tweet.fullText || tweet.text || '',
      author_name: tweet.tweetBy?.userName || username,
      author_avatar: tweet.tweetBy?.profilePicture || '',
      posted_at: tweet.createdAt ? new Date(tweet.createdAt).toISOString() : new Date().toISOString(),
      tweet_url: `https://x.com/${username}/status/${tweet.id}`
    }));
    
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

