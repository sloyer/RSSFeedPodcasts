// lib/fetchTwitter.js - Twitter List Timeline Fetcher (Official API)
import { supabase } from './supabaseClient.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

const TWITTER_LIST_ID = '2000142633893789982'; // Your curated list

// Generate OAuth 1.0a signature for Twitter API
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  
  return signature;
}

// Fetch tweets from Twitter List using official API
async function fetchTweetsFromList(listId = TWITTER_LIST_ID, count = 100) {
  try {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;
    
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      throw new Error('Twitter API credentials not configured');
    }
    
    // Twitter API v1.1 endpoint for list timeline
    const url = 'https://api.twitter.com/1.1/lists/statuses.json';
    const method = 'GET';
    
    // OAuth parameters
    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_token: accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(32).toString('base64').replace(/\W/g, ''),
      oauth_version: '1.0'
    };
    
    // Request parameters
    const requestParams = {
      list_id: listId,
      count: count,
      include_entities: 'true',
      include_rts: 'false' // Exclude retweets for cleaner feed
    };
    
    // Combine for signature
    const allParams = { ...oauthParams, ...requestParams };
    const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessSecret);
    oauthParams.oauth_signature = signature;
    
    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');
    
    // Build request URL with query params
    const queryString = Object.keys(requestParams)
      .map(key => `${key}=${encodeURIComponent(requestParams[key])}`)
      .join('&');
    const requestUrl = `${url}?${queryString}`;
    
    // Make API request
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'RSS Aggregator/1.0'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🐦 Twitter API Error ${response.status}:`, errorText);
      throw new Error(`Twitter API error ${response.status}: ${errorText}`);
    }
    
    const tweets = await response.json();
    console.log(`🐦 API returned ${tweets.length} tweets from list`);
    
    // Convert to our format
    return tweets.map(tweet => ({
      twitter_id: tweet.id_str,
      account_username: tweet.user.screen_name,
      text: tweet.text || '',
      author_name: tweet.user.name || tweet.user.screen_name,
      author_avatar: tweet.user.profile_image_url_https || '',
      posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
      tweet_url: `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`
    }));
    
  } catch (error) {
    console.error(`  ❌ Error fetching list timeline:`, error.message);
    return [];
  }
}

// Main function to fetch Twitter feeds from list
async function fetchTwitterFeeds(daysBack = 3) {
  const startTime = Date.now();
  let totalTweets = 0;
  
  try {
    console.log(`🐦 Starting Twitter list fetch (${daysBack} days)...`);
    
    // Fetch tweets from the list (ONE API call for all accounts!)
    const tweets = await fetchTweetsFromList(TWITTER_LIST_ID, 100);
    
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

