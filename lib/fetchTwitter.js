// lib/fetchTwitter.js - RapidAPI Twitter Integration (Actually Works!)
import { supabase } from './supabaseClient.js';
import fetch from 'node-fetch';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '584bf73c1cmsh3e22e0fa712a96dp1ad7b3jsn17c19d2f5de4';
const RAPIDAPI_HOST = 'twitter-api45.p.rapidapi.com';

function randomDelay(min = 500, max = 1000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Fetch tweets from a user (twitter-api45 - simpler, better quality)
async function fetchTweetsFromUser(username, count = 5) {
  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/timeline.php?screenname=${username}`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // twitter-api45 has simple structure: { timeline: [...] }
    const timeline = data?.timeline || [];
    if (timeline.length === 0) {
      return [];
    }
    
    const tweets = [];
    
    for (const tweet of timeline.slice(0, count)) {
      try {
        // Skip retweets
        if (tweet.retweeted_status || tweet.text?.startsWith('RT @')) {
          continue;
        }
        
        // Skip replies
        if (tweet.in_reply_to_status_id || tweet.in_reply_to_user_id) {
          continue;
        }
        
        // Verify this tweet is from the user we requested (not someone else's)
        if (tweet.screen_name && tweet.screen_name.toLowerCase() !== username.toLowerCase()) {
          console.log(`  ⚠️ Skipping - wrong author: @${tweet.screen_name} (expected @${username})`);
          continue;
        }
        
        tweets.push({
          twitter_id: tweet.id_str,
          account_username: username,
          text: tweet.text || '',
          author_name: tweet.name || username,
          author_avatar: tweet.profile_image_url_https || '',
          posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
          tweet_url: `https://x.com/${username}/status/${tweet.id_str}`
        });
      } catch (e) {
        // Skip malformed tweets
      }
    }
    
    return tweets;
    
  } catch (error) {
    console.error(`  ❌ Error fetching tweets for @${username}:`, error.message);
    return [];
  }
}

// Main function to fetch Twitter feeds
async function fetchTwitterFeeds(daysBack = 2) { // 48 hours
  const startTime = Date.now();
  let totalTweets = 0;
  
  try {
    console.log(`🐦 Starting Twitter fetch via RapidAPI (${daysBack} days)...`);
    
    // Get active Twitter accounts
    const { data: accounts, error: accountError } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('is_active', true);
    
    if (accountError) throw accountError;
    
    console.log(`📊 Fetching tweets from ${accounts.length} accounts...`);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    let allTweets = [];
    
    // Fetch from each account
    for (const account of accounts) {
      try {
        console.log(`📥 @${account.username}...`);
        
        // Fetch tweets (twitter-api45 uses screenname directly, no user ID needed!)
        const tweets = await fetchTweetsFromUser(account.username, 5);
        
        if (tweets.length === 0) {
          console.log(`  No tweets found`);
          continue;
        }
        
        console.log(`  📊 Got ${tweets.length} tweets`);
        
        if (tweets.length > 0) {
          // Filter to recent tweets and FORCE correct author info
          const recentTweets = tweets.filter(tweet => {
            const tweetDate = new Date(tweet.posted_at);
            return tweetDate >= cutoffDate;
          }).map(tweet => ({
            ...tweet,
            // FORCE use of account data (API returns unreliable author info)
            account_username: account.username,
            author_name: displayName || account.username,
            author_avatar: avatarUrl || ''
          }));
          
          console.log(`  ✅ ${recentTweets.length} recent tweets`);
          allTweets = allTweets.concat(recentTweets);
        } else {
          console.log(`  No tweets found`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing @${account.username}:`, error.message);
      }
    }
    
    // Store all tweets (deduplicate first)
    if (allTweets.length > 0) {
      // Remove duplicates by twitter_id (same tweet can appear in multiple timelines)
      const uniqueTweets = Array.from(
        new Map(allTweets.map(tweet => [tweet.twitter_id, tweet])).values()
      );
      
      console.log(`📊 Deduplicating: ${allTweets.length} total → ${uniqueTweets.length} unique`);
      
      const { error: insertError } = await supabase
        .from('tweets')
        .upsert(uniqueTweets, {
          onConflict: 'twitter_id',
          ignoreDuplicates: false
        });
      
      if (insertError) {
        console.error('❌ Error inserting tweets:', insertError);
      } else {
        totalTweets = allTweets.length;
        console.log(`✅ Stored ${totalTweets} tweets`);
      }
    }
    
    // Clean up old tweets
    const { error: deleteError } = await supabase
      .from('tweets')
      .delete()
      .lt('posted_at', cutoffDate.toISOString());
    
    if (deleteError) {
      console.error('❌ Error deleting old tweets:', deleteError);
    }
    
    const duration = (Date.now() - startTime) / 1000;
    const uniqueAccounts = new Set(allTweets.map(t => t.account_username));
    console.log(`\n✅ Twitter fetch complete: ${totalTweets} tweets from ${uniqueAccounts.size} accounts in ${duration}s`);
    
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
