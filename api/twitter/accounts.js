// api/twitter/accounts.js - Twitter Accounts Discovery API
import { supabase } from '../../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get all active Twitter accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('twitter_accounts')
      .select('username, display_name, avatar_url')
      .eq('is_active', true);
    
    if (accountsError) throw accountsError;
    
    // Get all tweets for these accounts
    const { data: tweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('account_username, posted_at')
      .in('account_username', accounts.map(a => a.username))
      .order('posted_at', { ascending: false });
    
    if (tweetsError) throw tweetsError;
    
    // Process data to get stats per account
    const accountMap = new Map();
    
    // Initialize all accounts
    accounts.forEach(account => {
      accountMap.set(account.username, {
        account_name: account.display_name || account.username,
        username: account.username,
        avatar_url: account.avatar_url,
        tweet_count: 0,
        latest_tweet_date: null,
        has_tweets: false
      });
    });
    
    // Add tweet stats
    tweets.forEach(tweet => {
      const account = accountMap.get(tweet.account_username);
      if (account) {
        account.tweet_count++;
        account.has_tweets = true;
        
        if (!account.latest_tweet_date || 
            new Date(tweet.posted_at) > new Date(account.latest_tweet_date)) {
          account.latest_tweet_date = tweet.posted_at;
        }
      }
    });
    
    // Convert to array and sort by latest tweet
    const accountData = Array.from(accountMap.values());
    accountData.sort((a, b) => {
      if (!a.latest_tweet_date) return 1;
      if (!b.latest_tweet_date) return -1;
      return new Date(b.latest_tweet_date) - new Date(a.latest_tweet_date);
    });
    
    return res.status(200).json({
      success: true,
      data: accountData,
      total_accounts: accountData.length
    });
    
  } catch (error) {
    console.error('Twitter Accounts API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}

