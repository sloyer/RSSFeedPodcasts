# Twitter Feed Integration Guide

## Overview

Your backend now fetches tweets from 19 motocross Twitter accounts using RapidAPI. Tweets are stored in Supabase and served via API endpoints following the same pattern as your news, podcasts, and videos.

**Key Features:**
- ✅ Automatically fetches tweets every 15 minutes
- ✅ Only stores last 3 days of tweets
- ✅ Multi-account filtering (just like news/podcasts/videos)
- ✅ Manual pull-to-refresh capability
- ✅ Chronological feed

---

## Base URL

```
https://rss-feed-podcasts.vercel.app/api
```

---

## API Endpoints

### 1. Discovery - Get Available Twitter Accounts

```http
GET /api/twitter/accounts
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "account_name": "Steve Matthes",
      "username": "pulpmx",
      "avatar_url": "https://pbs.twimg.com/profile_images/.../...",
      "tweet_count": 12,
      "latest_tweet_date": "2025-12-14T10:00:00Z",
      "has_tweets": true
    },
    {
      "account_name": "Lewis Phillips",
      "username": "LewisPhillips71",
      "tweet_count": 8,
      "latest_tweet_date": "2025-12-14T09:30:00Z",
      "has_tweets": true
    }
  ],
  "total_accounts": 19
}
```

**Use For:**
- Display Twitter accounts in settings
- Show tweet counts  
- Store usernames for filtering

---

### 2. Get Tweets (All Accounts)

```http
GET /api/tweets?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "twitter_id": "1234567890",
      "account_username": "pulpmx",
      "author_name": "Steve Matthes",
      "author_avatar": "https://pbs.twimg.com/profile_images/...",
      "text": "Tweet content here...",
      "posted_at": "2025-12-14T10:00:00Z",
      "tweet_url": "https://x.com/pulpmx/status/1234567890"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "count": 20
  }
}
```

---

### 3. Get Tweets (Selected Accounts Only)

```http
GET /api/tweets?accounts=pulpmx,racerxonline,LewisPhillips71&limit=20
```

**Multi-account filtering** - same pattern as news/podcasts/videos!

**Parameters:**
- `accounts` - Comma-separated usernames
- `limit` - Number of tweets (default: 20)
- `offset` - Pagination offset (default: 0)
- `search` - Search in tweet text

---

### 4. Manual Pull-to-Refresh

```http
POST /api/trigger-twitter-pull
```

**Use for:** Pull-to-refresh in your app  
**Rate limit:** Max once per minute

**Response:**
```json
{
  "success": true,
  "message": "Manual Twitter pull completed",
  "data": {
    "tweets_fetched": 15,
    "accounts_processed": 8,
    "duration_seconds": 45.2
  }
}
```

---

## React Native Implementation

### Settings Screen - Twitter Account Selection

```javascript
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TwitterSettings = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  useEffect(() => {
    loadTwitterAccounts();
    loadSelections();
  }, []);

  const loadTwitterAccounts = async () => {
    const response = await fetch(
      'https://rss-feed-podcasts.vercel.app/api/twitter/accounts'
    );
    const data = await response.json();
    setAccounts(data.data);
  };

  const loadSelections = async () => {
    const saved = await AsyncStorage.getItem('twitter_selections');
    if (saved) setSelectedAccounts(JSON.parse(saved));
  };

  const toggleAccount = (username) => {
    setSelectedAccounts(prev => {
      const updated = prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username];
      
      AsyncStorage.setItem('twitter_selections', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <ScrollView>
      <Text style={styles.header}>Twitter Accounts</Text>
      {accounts.map(account => (
        <TouchableOpacity
          key={account.username}
          onPress={() => toggleAccount(account.username)}
          style={styles.accountItem}
        >
          <Image 
            source={{ uri: account.avatar_url }} 
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text style={styles.name}>
              {selectedAccounts.includes(account.username) ? '☑' : '☐'} 
              {account.account_name}
            </Text>
            <Text style={styles.username}>@{account.username}</Text>
            <Text style={styles.meta}>{account.tweet_count} tweets</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

---

### Twitter Feed Screen

```javascript
const TwitterFeedScreen = () => {
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTweets();
  }, []);

  const loadTweets = async () => {
    setLoading(true);
    
    // Get user's selected accounts
    const saved = await AsyncStorage.getItem('twitter_selections');
    const selections = JSON.parse(saved || '[]');
    
    if (selections.length === 0) {
      setLoading(false);
      return; // No accounts selected
    }

    // Single API call with all selected accounts
    const accountsParam = encodeURIComponent(selections.join(','));
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/tweets?accounts=${accountsParam}&limit=20`
    );
    
    const data = await response.json();
    setTweets(data.data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Trigger manual fetch
    await fetch('https://rss-feed-podcasts.vercel.app/api/trigger-twitter-pull', {
      method: 'POST'
    });
    
    // Wait a bit then reload
    setTimeout(() => {
      loadTweets();
      setRefreshing(false);
    }, 2000);
  };

  const renderTweet = ({ item }) => (
    <View style={styles.tweetCard}>
      <View style={styles.tweetHeader}>
        <Image 
          source={{ uri: item.author_avatar }} 
          style={styles.avatar}
        />
        <View>
          <Text style={styles.authorName}>{item.author_name}</Text>
          <Text style={styles.username}>@{item.account_username}</Text>
        </View>
        <Text style={styles.time}>
          {formatTime(item.posted_at)}
        </Text>
      </View>
      
      <Text style={styles.tweetText}>{item.text}</Text>
      
      <TouchableOpacity 
        onPress={() => Linking.openURL(item.tweet_url)}
        style={styles.viewOnTwitter}
      >
        <Text>View on X</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={tweets}
      keyExtractor={item => item.twitter_id}
      renderItem={renderTweet}
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={
        <EmptyState message="Select Twitter accounts in Settings" />
      }
    />
  );
};

// Helper function
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};
```

---

## Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `accounts` | string | Comma-separated usernames | `pulpmx,racerxonline` |
| `limit` | integer | Number of tweets to return | `20` |
| `offset` | integer | Pagination offset | `0` |
| `search` | string | Search in tweet text | `supercross` |

**Examples:**
```
GET /api/tweets?accounts=pulpmx,LewisPhillips71&limit=20
GET /api/tweets?search=supercross&limit=10
GET /api/tweets?accounts=pulpmx&offset=20&limit=20  // Page 2
```

---

## Data Flow

```
1. Settings Page:
   GET /api/twitter/accounts → User selects accounts → Save selections

2. Twitter Feed Tab:
   Load selections → Call /api/tweets?accounts=... → Display tweets

3. Pull to Refresh:
   POST /api/trigger-twitter-pull → Wait → Reload tweets
```

---

## Important Notes

### Costs
- **RapidAPI Free Tier:** 10 requests/month (for testing only)
- **Production:** Need Basic plan (~$20-30/month)
- Your backend fetches every 15 minutes automatically

### Data Freshness
- Auto-fetch: Every 15 minutes
- Manual: Pull-to-refresh (rate limited to 1/min)
- Storage: Last 3 days only (auto-deleted)

### Rate Limits
- RapidAPI has its own rate limits (check your plan)
- Manual trigger limited to prevent spam
- Backend respects delays between accounts

---

## Testing

Test the endpoints:

```bash
# Get accounts
curl https://rss-feed-podcasts.vercel.app/api/twitter/accounts

# Get all tweets
curl https://rss-feed-podcasts.vercel.app/api/tweets?limit=5

# Get tweets from specific accounts
curl "https://rss-feed-podcasts.vercel.app/api/tweets?accounts=pulpmx,racerxonline&limit=10"

# Trigger manual fetch
curl -X POST https://rss-feed-podcasts.vercel.app/api/trigger-twitter-pull
```

---

## Complete Example - Unified Feed

Combine Twitter with news/podcasts/videos:

```javascript
const UnifiedFeedScreen = () => {
  const [allContent, setAllContent] = useState([]);
  
  const loadAllContent = async () => {
    const prefs = await AsyncStorage.getItem('content_selections');
    const selections = JSON.parse(prefs);
    
    // Fetch all content types in parallel
    const [news, podcasts, videos, tweets] = await Promise.all([
      fetch(`/api/articles?sources=${selections.news.join(',')}&limit=10`).then(r => r.json()),
      fetch(`/api/podcasts?shows=${selections.podcasts.join(',')}&limit=10`).then(r => r.json()),
      fetch(`/api/youtube?channels=${selections.videos.join(',')}&limit=10`).then(r => r.json()),
      fetch(`/api/tweets?accounts=${selections.twitter.join(',')}&limit=10`).then(r => r.json())
    ]);
    
    // Combine all content
    const combined = [
      ...news.data.map(item => ({ ...item, type: 'article', date: item.published_date })),
      ...podcasts.data.map(item => ({ ...item, type: 'podcast', date: item.podcast_date })),
      ...videos.data.map(item => ({ ...item, type: 'video', date: item.publishedAt })),
      ...tweets.data.map(item => ({ ...item, type: 'tweet', date: item.posted_at }))
    ];
    
    // Sort by date (newest first)
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setAllContent(combined);
  };
  
  return (
    <FlatList
      data={allContent}
      renderItem={({ item }) => {
        switch (item.type) {
          case 'article': return <ArticleCard {...item} />;
          case 'podcast': return <PodcastCard {...item} />;
          case 'video': return <VideoCard {...item} />;
          case 'tweet': return <TweetCard {...item} />;
        }
      }}
    />
  );
};
```

---

## Summary

**Twitter integration complete!** 🎉

- **Discovery:** `/api/twitter/accounts`
- **Tweets:** `/api/tweets?accounts=pulpmx,racerxonline`
- **Manual refresh:** `POST /api/trigger-twitter-pull`
- **Same pattern** as your existing content types
- **Cost:** $20-30/month for RapidAPI Basic plan

Your app can now show tweets alongside news, podcasts, and videos in a unified feed!

