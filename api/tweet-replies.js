// api/tweet-replies.js - On-demand thread replies with 30-min caching
// First user fetches from X API and stores in Supabase.
// Subsequent users within 30 min get the cached version for free.

import { supabase } from '../lib/supabaseClient.js';

const X_API_BASE = 'https://api.twitter.com/2';
const CACHE_TTL_MINUTES = 30;

async function getBearerToken() {
  const credentials = Buffer.from(
    `${process.env.TWITTER_API_KEY}:${process.env.TWITTER_API_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) throw new Error('Failed to get Bearer Token');
  const data = await response.json();
  return data.access_token;
}

async function fetchRepliesFromX(tweetId, limit) {
  const bearerToken = await getBearerToken();

  const params = new URLSearchParams({
    query: `conversation_id:${tweetId} -is:retweet`,
    'tweet.fields': 'created_at,author_id,text,public_metrics,attachments',
    expansions: 'author_id,attachments.media_keys',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type',
    max_results: String(Math.min(parseInt(limit) || 20, 100)),
    sort_order: 'recency'
  });

  const response = await fetch(`${X_API_BASE}/tweets/search/recent?${params}`, {
    headers: { 'Authorization': `Bearer ${bearerToken}` }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.detail || response.statusText);
  }

  const data = await response.json();
  if (!data.data || data.data.length === 0) return [];

  // Build lookups
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

  const mediaMap = {};
  if (data.includes?.media) {
    for (const media of data.includes.media) {
      mediaMap[media.media_key] = media.url || media.preview_image_url || null;
    }
  }

  return data.data.map(tweet => {
    const author = authorMap[tweet.author_id] || {};
    const imageUrl = tweet.attachments?.media_keys?.length > 0
      ? (mediaMap[tweet.attachments.media_keys[0]] || null)
      : null;

    return {
      twitter_id: tweet.id,
      text: tweet.text,
      author_name: author.name || 'Unknown',
      author_username: author.username || '',
      author_avatar: author.avatar || null,
      posted_at: tweet.created_at,
      tweet_url: `https://x.com/${author.username}/status/${tweet.id}`,
      image_url: imageUrl,
      like_count: tweet.public_metrics?.like_count || 0,
      retweet_count: tweet.public_metrics?.retweet_count || 0,
      reply_count: tweet.public_metrics?.reply_count || 0,
      quote_count: tweet.public_metrics?.quote_count || 0
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { tweet_id, limit = 20 } = req.query;

  if (!tweet_id) {
    return res.status(400).json({ success: false, error: 'tweet_id is required' });
  }

  try {
    // Check cache first
    const cacheExpiry = new Date(Date.now() - CACHE_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: cached } = await supabase
      .from('tweet_replies')
      .select('replies, fetched_at')
      .eq('tweet_id', tweet_id)
      .gt('fetched_at', cacheExpiry)
      .single();

    if (cached) {
      // Serve from cache - free
      return res.status(200).json({
        success: true,
        data: cached.replies,
        count: cached.replies.length,
        cached: true,
        cached_at: cached.fetched_at
      });
    }

    // Cache miss - fetch from X API
    const replies = await fetchRepliesFromX(tweet_id, limit);

    // Store in cache (upsert so re-fetches update existing row)
    if (replies.length > 0) {
      await supabase
        .from('tweet_replies')
        .upsert({
          tweet_id,
          replies,
          fetched_at: new Date().toISOString()
        }, { onConflict: 'tweet_id' });
    }

    return res.status(200).json({
      success: true,
      data: replies,
      count: replies.length,
      cached: false
    });

  } catch (error) {
    console.error('Tweet replies error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
