// lib/fetchTwitter.js - Official X API v2 Integration
import { supabase } from './supabaseClient.js';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const X_API_BASE = 'https://api.twitter.com/2';

// Get Bearer Token from API Key + Secret (App-only OAuth2)
async function getBearerToken() {
  const credentials = Buffer.from(`${TWITTER_API_KEY}:${TWITTER_API_SECRET}`).toString('base64');

  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Failed to get Bearer Token: ${err.error_description || response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Resolve usernames → user IDs and store them (one-time per account)
async function resolveUserIds(bearerToken, accounts) {
  const unresolved = accounts.filter(a => !a.twitter_user_id);
  if (unresolved.length === 0) return;

  const usernames = unresolved.map(a => a.username).join(',');
  const response = await fetch(
    `${X_API_BASE}/users/by?usernames=${usernames}&user.fields=name,username,profile_image_url`,
    { headers: { 'Authorization': `Bearer ${bearerToken}` } }
  );

  if (!response.ok) {
    console.error('Failed to resolve user IDs:', await response.text());
    return;
  }

  const data = await response.json();
  if (!data.data) return;

  for (const user of data.data) {
    await supabase
      .from('twitter_accounts')
      .update({
        twitter_user_id: user.id,
        display_name: user.name,
        avatar_url: user.profile_image_url?.replace('_normal.', '_400x400.')
      })
      .eq('username', user.username);

    console.log(`  ✅ Resolved @${user.username} → ID ${user.id}`);
  }
}

// Fetch new tweets for one account using since_id to minimize reads
async function fetchNewTweets(bearerToken, account) {
  const params = new URLSearchParams({
    max_results: '10',
    'tweet.fields': 'created_at,author_id,text,attachments',
    expansions: 'author_id,attachments.media_keys',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type'
  });

  // Only fetch tweets newer than the last one we stored (saves reads/cost)
  if (account.last_tweet_id) {
    params.set('since_id', account.last_tweet_id);
  }

  const response = await fetch(
    `${X_API_BASE}/users/${account.twitter_user_id}/tweets?${params}`,
    { headers: { 'Authorization': `Bearer ${bearerToken}` } }
  );

  if (!response.ok) {
    const err = await response.json();
    console.error(`  ❌ API error for @${account.username}:`, err?.detail || response.statusText);
    return [];
  }

  const data = await response.json();

  if (!data.data || data.data.length === 0) return [];

  // Build media lookup map
  const mediaMap = {};
  if (data.includes?.media) {
    for (const media of data.includes.media) {
      mediaMap[media.media_key] = media.url || media.preview_image_url || null;
    }
  }

  // Build author lookup map
  const authorMap = {};
  if (data.includes?.users) {
    for (const user of data.includes.users) {
      authorMap[user.id] = {
        name: user.name,
        username: user.username,
        avatar: user.profile_image_url?.replace('_normal.', '_400x400.')
      };
    }
  }

  const tweets = [];
  for (const tweet of data.data) {
    // Skip retweets
    if (tweet.text?.startsWith('RT @')) continue;

    const author = authorMap[tweet.author_id] || {};

    // Get first image if available
    let imageUrl = null;
    if (tweet.attachments?.media_keys?.length > 0) {
      imageUrl = mediaMap[tweet.attachments.media_keys[0]] || null;
    }

    tweets.push({
      twitter_id: tweet.id,
      account_username: account.username,
      text: tweet.text,
      author_name: author.name || account.display_name || account.username,
      author_avatar: author.avatar || account.avatar_url || null,
      posted_at: tweet.created_at,
      tweet_url: `https://x.com/${account.username}/status/${tweet.id}`,
      image_url: imageUrl
    });
  }

  return tweets;
}

// Main function
async function fetchTwitterFeeds(daysBack = 2) {
  const startTime = Date.now();
  let totalTweets = 0;

  try {
    if (!TWITTER_API_KEY || !TWITTER_API_SECRET) {
      throw new Error('TWITTER_API_KEY and TWITTER_API_SECRET are required');
    }

    console.log('🐦 Starting X API fetch...');

    // Get Bearer Token from existing credentials
    const bearerToken = await getBearerToken();
    console.log('✅ Bearer Token obtained');

    // Get active accounts
    const { data: accounts, error: accountError } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('is_active', true);

    if (accountError) throw accountError;
    console.log(`📊 Processing ${accounts.length} accounts...`);

    // Resolve any accounts that don't have a user ID yet
    await resolveUserIds(bearerToken, accounts);

    // Re-fetch accounts with updated IDs
    const { data: resolvedAccounts } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('is_active', true)
      .not('twitter_user_id', 'is', null);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    let allTweets = [];

    for (const account of resolvedAccounts) {
      try {
        console.log(`📥 @${account.username}...`);
        const tweets = await fetchNewTweets(bearerToken, account);

        if (tweets.length > 0) {
          console.log(`  ✅ ${tweets.length} new tweets`);
          allTweets = allTweets.concat(tweets);

          // Update last_tweet_id so next run only fetches newer tweets
          await supabase
            .from('twitter_accounts')
            .update({
              last_fetched: new Date().toISOString(),
              last_tweet_id: tweets[0].twitter_id
            })
            .eq('username', account.username);
        } else {
          console.log(`  — No new tweets`);
        }
      } catch (err) {
        console.error(`❌ Error for @${account.username}:`, err.message);
      }
    }

    // Upsert all new tweets
    if (allTweets.length > 0) {
      const { error: insertError } = await supabase
        .from('tweets')
        .upsert(allTweets, { onConflict: 'twitter_id', ignoreDuplicates: false });

      if (insertError) {
        console.error('❌ Error inserting tweets:', insertError.message);
      } else {
        totalTweets = allTweets.length;
        console.log(`✅ Stored ${totalTweets} new tweets`);
      }
    }

    // Delete tweets older than 48 hours
    const { error: deleteError } = await supabase
      .from('tweets')
      .delete()
      .lt('posted_at', cutoffDate.toISOString());

    if (deleteError) {
      console.error('❌ Error deleting old tweets:', deleteError.message);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ X fetch complete: ${totalTweets} new tweets in ${duration}s`);

    return { success: true, tweetsAdded: totalTweets };

  } catch (error) {
    console.error('💥 Fatal error in X fetch:', error.message);
    return { success: false, error: error.message };
  }
}

export { fetchTwitterFeeds };
