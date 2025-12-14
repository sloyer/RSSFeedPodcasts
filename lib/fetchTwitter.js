// lib/fetchTwitter.js - RapidAPI Twitter Integration (Actually Works!)
import { supabase } from './supabaseClient.js';
import fetch from 'node-fetch';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '584bf73c1cmsh3e22e0fa712a96dp1ad7b3jsn17c19d2f5de4';
const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';

function randomDelay(min = 500, max = 1000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Get user ID from username
async function getUserId(username) {
  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/about-account?username=${username}`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const userId = data?.result?.data?.user_result_by_screen_name?.result?.rest_id;
    
    if (!userId) {
      throw new Error('User ID not found in response');
    }
    
    return userId;
  } catch (error) {
    console.error(`  ❌ Error getting user ID for @${username}:`, error.message);
    return null;
  }
}

// Fetch tweets from a user
async function fetchTweetsFromUser(username, userId, count = 5) {
  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/user-tweets?user=${userId}&count=${count}`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse tweets from response (structure varies)
    const timeline = data?.result?.timeline;
    if (!timeline) {
      return [];
    }
    
    const tweets = [];
    const instructions = timeline.instructions || [];
    
    for (const instruction of instructions) {
      const entries = instruction.entries || [];
      
      for (const entry of entries) {
        try {
          const tweetResult = entry.content?.itemContent?.tweet_results?.result;
          if (!tweetResult || tweetResult.__typename !== 'Tweet') continue;
          
          const legacy = tweetResult.legacy;
          if (!legacy) continue;
          
          // Skip retweets
          if (legacy.retweeted_status_result || 
              legacy.full_text?.startsWith('RT @') ||
              legacy.text?.startsWith('RT @')) {
            continue;
          }
          
          // Skip replies (they're to other people, not original content)
          if (legacy.in_reply_to_status_id_str || 
              legacy.in_reply_to_user_id_str) {
            continue;
          }
          
          // We already have correct author info from account fetch above
          // Don't try to parse it from tweet JSON (unreliable)
          tweets.push({
            twitter_id: legacy.id_str,
            account_username: username,
            text: legacy.full_text || legacy.text || '',
            author_name: '', // Will be set from account data
            author_avatar: '', // Will be set from account data  
            posted_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : new Date().toISOString(),
            tweet_url: `https://x.com/${username}/status/${legacy.id_str}`
          });
        } catch (e) {
          // Skip malformed tweets
        }
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
    
    // Create avatar map from accounts we're fetching
    const avatarMap = new Map();
    
    // Fetch from each account
    for (const account of accounts) {
      try {
        console.log(`📥 @${account.username}...`);
        
        // Get user info (includes avatar)
        const userInfoResponse = await fetch(`https://${RAPIDAPI_HOST}/about-account?username=${account.username}`, {
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY
          }
        });
        
        if (!userInfoResponse.ok) {
          console.log(`  ⚠️ Could not get user info, skipping`);
          continue;
        }
        
        const userInfo = await userInfoResponse.json();
        const userResult = userInfo?.result?.data?.user_result_by_screen_name?.result;
        const userId = userResult?.rest_id;
        const displayName = userResult?.core?.name;
        let avatarUrl = userResult?.avatar?.image_url || '';
        
        // Fix avatar URL issues
        if (avatarUrl) {
          // Convert http to https (mobile apps block http)
          avatarUrl = avatarUrl.replace('http://', 'https://');
          // Upgrade from tiny "normal" to bigger size
          avatarUrl = avatarUrl.replace('_normal.', '_400x400.');
        }
        
        if (!userId) {
          console.log(`  ⚠️ Could not get user ID, skipping`);
          continue;
        }
        
        // Store avatar for this account
        avatarMap.set(account.username, avatarUrl);
        
        // Update account with display name and avatar
        await supabase
          .from('twitter_accounts')
          .update({ 
            display_name: displayName,
            avatar_url: avatarUrl,
            last_fetched: new Date().toISOString()
          })
          .eq('username', account.username);
        
        // Delay between requests
        await randomDelay(500, 1000);
        
        // Fetch tweets
        const tweets = await fetchTweetsFromUser(account.username, userId, 5);
        
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
