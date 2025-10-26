# 📱 App Integration Guide: Content Discovery & Feed Filtering

## Overview

This system provides a **two-step architecture** for content discovery and personalized feeds:

1. **Discovery** - User selects which sources they want (Settings Page)
2. **Filtering** - App shows only content from selected sources (Feed Tabs)

All source mappings are **auto-generated** from the database - no hardcoding required.

---

## Base URL

```
https://rss-feed-podcasts.vercel.app/api
```

---

## 🎯 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Settings/Discovery Page                            │
│  ─────────────────────────────────────────────────────────  │
│  User sees all available sources:                           │
│  ☑ Vital MX (150 articles)                                  │
│  ☑ Racer X (89 articles)                                    │
│  ☐ PulpMX Show (45 episodes)                                │
│  ☑ Swapmoto Live Videos (23 videos)                         │
│                                                              │
│  API Calls:                                                  │
│  GET /api/news/sources                                       │
│  GET /api/podcasts/shows                                     │
│  GET /api/videos/channels                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: User Saves Selections                              │
│  ─────────────────────────────────────────────────────────  │
│  App stores selected sources locally or via API:            │
│  - Vital MX (endpoint_url: /api/articles?group_by_source...)│
│  - Racer X (endpoint_url: /api/articles?group_by_source...) │
│  - Swapmoto Live (endpoint_url: /api/youtube?channel_id...) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Feed Tabs (Filtered Content)                       │
│  ─────────────────────────────────────────────────────────  │
│  📰 News Tab: Shows only Vital MX + Racer X articles        │
│  🎙️ Podcasts Tab: Empty (user didn't select any)            │
│  📺 Videos Tab: Shows only Swapmoto Live videos              │
│                                                              │
│  API Calls use the endpoint_url from discovery:             │
│  GET /api/articles?group_by_source=VITALMX                  │
│  GET /api/articles?group_by_source=RACERX                   │
│  GET /api/youtube?channel_id=SWAPMOTOLIVE                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 Step 1: Discovery Endpoints (Settings Page)

These endpoints provide **all available sources** with metadata for the settings/preferences screen.

### 1.1 Discover News Sources

```http
GET /api/news/sources
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "source_name": "Vital MX",
      "feed_name": "Vital MX RSS Feed",
      "article_count": 150,
      "latest_article_date": "2025-10-23T08:00:00Z",
      "source_image": "https://...",
      "endpoint_url": "/api/articles?group_by_source=VITALMX",
      "description": "Latest motocross news from Vital MX",
      "has_articles": true
    },
    {
      "source_name": "Racer X",
      "feed_name": "Racer X Online",
      "article_count": 89,
      "latest_article_date": "2025-10-22T14:30:00Z",
      "source_image": "https://...",
      "endpoint_url": "/api/articles?group_by_source=RACERX",
      "description": "Racer X motocross and supercross coverage",
      "has_articles": true
    }
  ],
  "total_sources": 2
}
```

**Use This For:**
- Display all available news sources in settings
- Show article counts and latest update time
- Store `endpoint_url` for later filtering

---

### 1.2 Discover Podcast Shows

```http
GET /api/podcasts/shows
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "show_name": "Gypsy Tales",
      "episode_count": 45,
      "latest_episode_date": "2025-10-21T10:00:00Z",
      "show_image": "https://...",
      "endpoint_url": "/api/podcasts?podcast_name=Gypsy%20Tales",
      "description": "Motocross stories and interviews",
      "has_episodes": true
    },
    {
      "show_name": "The PulpMX.com Show",
      "episode_count": 67,
      "latest_episode_date": "2025-10-20T12:00:00Z",
      "show_image": "https://...",
      "endpoint_url": "/api/podcasts?podcast_name=The%20PulpMX.com%20Show",
      "description": "Weekly motocross podcast",
      "has_episodes": true
    }
  ],
  "total_shows": 2
}
```

**Use This For:**
- Display all available podcast shows in settings
- Show episode counts and latest episode date
- Store `endpoint_url` for later filtering

---

### 1.3 Discover YouTube Channels

```http
GET /api/videos/channels
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "channel_name": "Swapmoto Live",
      "channel_id": "UCxxxxx",
      "video_count": 23,
      "latest_video_date": "2025-10-23T16:00:00Z",
      "channel_image": "https://...",
      "endpoint_url": "/api/youtube?channel_id=SWAPMOTOLIVE",
      "description": "Live motocross coverage and interviews",
      "has_videos": true
    },
    {
      "channel_name": "Vital MX",
      "channel_id": "UCyyyyy",
      "video_count": 34,
      "latest_video_date": "2025-10-22T09:00:00Z",
      "channel_image": "https://...",
      "endpoint_url": "/api/youtube?channel_id=VITALMX",
      "description": "Vital MX video content",
      "has_videos": true
    }
  ],
  "total_channels": 2
}
```

**Use This For:**
- Display all available YouTube channels in settings
- Show video counts and latest video date
- Store `endpoint_url` for later filtering

---

## 🎨 Step 2: Rendering the Settings Page

### Example Settings Screen Layout

```
┌─────────────────────────────────────────────────┐
│  Content Sources                                │
│                                                 │
│  📰 News Sources (2)                            │
│  ────────────────────────────────────────────  │
│  ☑ Vital MX                                     │
│    150 articles • Updated 2h ago                │
│    "Latest motocross news from Vital MX"        │
│                                                 │
│  ☑ Racer X                                      │
│    89 articles • Updated 5h ago                 │
│    "Racer X motocross and supercross coverage"  │
│                                                 │
│  🎙️ Podcast Shows (2)                           │
│  ────────────────────────────────────────────  │
│  ☐ Gypsy Tales                                  │
│    45 episodes • Updated 1d ago                 │
│    "Motocross stories and interviews"           │
│                                                 │
│  ☑ The PulpMX.com Show                          │
│    67 episodes • Updated 2d ago                 │
│    "Weekly motocross podcast"                   │
│                                                 │
│  📺 YouTube Channels (2)                        │
│  ────────────────────────────────────────────  │
│  ☑ Swapmoto Live                                │
│    23 videos • Updated 1h ago                   │
│    "Live motocross coverage and interviews"     │
│                                                 │
│  ☐ Vital MX                                     │
│    34 videos • Updated 1d ago                   │
│    "Vital MX video content"                     │
└─────────────────────────────────────────────────┘
```

### Data Structure to Store

When user saves selections, store this locally or send to backend:

```json
{
  "user_preferences": {
    "news_sources": [
      {
        "source_name": "Vital MX",
        "endpoint_url": "/api/articles?group_by_source=VITALMX"
      },
      {
        "source_name": "Racer X",
        "endpoint_url": "/api/articles?group_by_source=RACERX"
      }
    ],
    "podcast_shows": [
      {
        "show_name": "The PulpMX.com Show",
        "endpoint_url": "/api/podcasts?podcast_name=The%20PulpMX.com%20Show"
      }
    ],
    "youtube_channels": [
      {
        "channel_name": "Swapmoto Live",
        "endpoint_url": "/api/youtube?channel_id=SWAPMOTOLIVE"
      }
    ]
  }
}
```

---

## 📱 Step 3: Feed Tabs (Filtered Content)

Use the stored `endpoint_url` from user preferences to fetch only selected sources.

### 3.1 News Tab

**Scenario:** User selected "Vital MX" and "Racer X"

**API Calls:**
```http
GET /api/articles?group_by_source=VITALMX&limit=20
GET /api/articles?group_by_source=RACERX&limit=20
```

**Or combine them:**
```http
GET /api/articles?limit=40
```
Then filter client-side by checking if `article.company` matches selected sources.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "2025 Supercross Season Preview",
      "excerpt": "Everything you need to know...",
      "url": "https://vitalmx.com/article/...",
      "published_date": "2025-10-23T08:00:00Z",
      "image_url": "https://...",
      "company": "Vital MX",
      "author": "John Smith"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "count": 20 }
}
```

---

### 3.2 Podcasts Tab

**Scenario:** User selected "The PulpMX.com Show"

**API Call:**
```http
GET /api/podcasts?podcast_name=The%20PulpMX.com%20Show&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "podcast_name": "The PulpMX.com Show",
      "podcast_title": "Episode 567 - Season Recap",
      "podcast_description": "We discuss the 2025 season...",
      "podcast_date": "2025-10-20T12:00:00Z",
      "podcast_image": "https://...",
      "audio_url": "https://...mp3",
      "guid": "unique-episode-id"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "count": 20 }
}
```

---

### 3.3 Videos Tab

**Scenario:** User selected "Swapmoto Live"

**API Call:**
```http
GET /api/youtube?channel_id=SWAPMOTOLIVE&days=30&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123xyz",
      "channelId": "UCxxxxx",
      "channelName": "Swapmoto Live",
      "title": "2025 Supercross Round 1 Highlights",
      "description": "Best moments from opening round...",
      "publishedAt": "2025-10-23T16:00:00Z",
      "thumbnailUrl": "https://img.youtube.com/vi/abc123xyz/maxresdefault.jpg",
      "duration": "PT10M30S",
      "embedUrl": "https://www.youtube.com/embed/abc123xyz",
      "watchUrl": "https://www.youtube.com/watch?v=abc123xyz",
      "embedHtml": "<iframe...>"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "count": 20 }
}
```

---

## 🔧 Implementation Examples

### React Native Example (Settings Screen)

```javascript
import React, { useState, useEffect } from 'react';

const SettingsScreen = () => {
  const [newsSources, setNewsSources] = useState([]);
  const [podcastShows, setPodcastShows] = useState([]);
  const [youtubeChannels, setYoutubeChannels] = useState([]);
  const [selectedSources, setSelectedSources] = useState({
    news: [],
    podcasts: [],
    youtube: []
  });

  useEffect(() => {
    // Fetch all available sources
    fetchDiscoveryData();
  }, []);

  const fetchDiscoveryData = async () => {
    // Fetch news sources
    const newsRes = await fetch('https://rss-feed-podcasts.vercel.app/api/news/sources');
    const newsData = await newsRes.json();
    setNewsSources(newsData.data);

    // Fetch podcast shows
    const podcastRes = await fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows');
    const podcastData = await podcastRes.json();
    setPodcastShows(podcastData.data);

    // Fetch YouTube channels
    const youtubeRes = await fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels');
    const youtubeData = await youtubeRes.json();
    setYoutubeChannels(youtubeData.data);
  };

  const toggleSource = (type, source) => {
    // Toggle source selection
    setSelectedSources(prev => {
      const current = prev[type];
      const isSelected = current.some(s => s.source_name === source.source_name);
      
      return {
        ...prev,
        [type]: isSelected 
          ? current.filter(s => s.source_name !== source.source_name)
          : [...current, { 
              source_name: source.source_name || source.show_name || source.channel_name,
              endpoint_url: source.endpoint_url 
            }]
      };
    });
  };

  const savePreferences = async () => {
    // Save to local storage or send to backend
    await AsyncStorage.setItem('user_preferences', JSON.stringify(selectedSources));
    console.log('Preferences saved:', selectedSources);
  };

  return (
    <ScrollView>
      <Text>News Sources</Text>
      {newsSources.map(source => (
        <TouchableOpacity 
          key={source.source_name}
          onPress={() => toggleSource('news', source)}
        >
          <Text>{source.source_name}</Text>
          <Text>{source.description}</Text>
          <Text>{source.article_count} articles</Text>
        </TouchableOpacity>
      ))}

      <Text>Podcast Shows</Text>
      {podcastShows.map(show => (
        <TouchableOpacity 
          key={show.show_name}
          onPress={() => toggleSource('podcasts', show)}
        >
          <Text>{show.show_name}</Text>
          <Text>{show.description}</Text>
          <Text>{show.episode_count} episodes</Text>
        </TouchableOpacity>
      ))}

      <Text>YouTube Channels</Text>
      {youtubeChannels.map(channel => (
        <TouchableOpacity 
          key={channel.channel_name}
          onPress={() => toggleSource('youtube', channel)}
        >
          <Text>{channel.channel_name}</Text>
          <Text>{channel.description}</Text>
          <Text>{channel.video_count} videos</Text>
        </TouchableOpacity>
      ))}

      <Button title="Save Preferences" onPress={savePreferences} />
    </ScrollView>
  );
};
```

### React Native Example (Feed Screen)

```javascript
import React, { useState, useEffect } from 'react';

const NewsFeedScreen = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFeed();
  }, []);

  const loadUserFeed = async () => {
    // Load user preferences
    const prefsJson = await AsyncStorage.getItem('user_preferences');
    const prefs = JSON.parse(prefsJson);

    // Fetch articles from each selected source
    const allArticles = [];
    
    for (const source of prefs.news) {
      const response = await fetch(
        `https://rss-feed-podcasts.vercel.app${source.endpoint_url}&limit=10`
      );
      const data = await response.json();
      allArticles.push(...data.data);
    }

    // Sort by date (newest first)
    allArticles.sort((a, b) => 
      new Date(b.published_date) - new Date(a.published_date)
    );

    setArticles(allArticles);
    setLoading(false);
  };

  return (
    <FlatList
      data={articles}
      renderItem={({ item }) => (
        <View>
          <Text>{item.title}</Text>
          <Text>{item.excerpt}</Text>
          <Text>{item.company}</Text>
        </View>
      )}
      keyExtractor={item => item.id.toString()}
    />
  );
};
```

---

## 🎯 Key Points for App Team

### ✅ DO's

1. **Use the discovery endpoints** (`/api/news/sources`, `/api/podcasts/shows`, `/api/videos/channels`) for the settings screen
2. **Store the `endpoint_url`** from discovery responses - use these URLs for filtering
3. **Read the `description` field** - use it to help users understand what each source is
4. **Check `has_articles`/`has_episodes`/`has_videos`** - you can hide sources with no content
5. **Show counts** (`article_count`, `episode_count`, `video_count`) - helps users see what's active
6. **Use pagination** - append `&limit=20&offset=0` to load more content

### ❌ DON'Ts

1. **Don't hardcode source names** - everything is database-driven
2. **Don't generate API codes manually** - use the `endpoint_url` provided
3. **Don't assume source names match between content types** - "Vital MX" exists in both news and videos
4. **Don't fetch all content upfront** - use the endpoint URLs to fetch only selected sources

---

## 📊 Query Parameters Reference

All content endpoints support these parameters:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Number of items to return | 20 |
| `offset` | integer | Pagination offset | 0 |
| `search` | string | Search in titles/descriptions | - |
| `days` | integer | Days back to fetch (videos only) | 7 |

**Example:**
```
GET /api/articles?group_by_source=VITALMX&limit=50&offset=0&search=supercross
```

---

## 🔐 CORS & Authentication

- **CORS**: All endpoints have `Access-Control-Allow-Origin: *` enabled
- **Authentication**: Currently no auth required for GET endpoints
- **Rate Limiting**: None currently (may be added later)

---

## 🐛 Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `405` - Method not allowed
- `500` - Server error

---

## 🚀 Multi-Source Filtering ⭐ NEW

The API now supports fetching from **multiple sources in a single call** instead of making separate requests for each source.

### Why Use Multi-Source Filtering?

**Before (Multiple Calls):**
```javascript
// 3 separate API calls
const vital = await fetch('/api/articles?group_by_source=VITALMX&limit=10');
const racerx = await fetch('/api/articles?group_by_source=RACERX&limit=10');
const mxvice = await fetch('/api/articles?group_by_source=MXVICE&limit=10');

// Combine and sort client-side
const all = [...vital.data, ...racerx.data, ...mxvice.data];
all.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
const top20 = all.slice(0, 20);
```

**After (Single Call):**
```javascript
// One API call, server does everything
const response = await fetch('/api/articles?sources=VITALMX,RACERX,MXVICE&limit=20');
const articles = response.data; // Done! ✅
```

### How to Use

Discovery endpoints now include an `api_code` field:

```javascript
// Get news sources
const newsResponse = await fetch('/api/news/sources');
// Response: [{ source_name: "Vital MX", api_code: "VITALMX", ... }]

// User selects sources
const selectedCodes = ['VITALMX', 'RACERX', 'MXVICE'];

// Single API call
const articles = await fetch(
  `/api/articles?sources=${selectedCodes.join(',')}&limit=20`
);
```

**Works for all content types:**
- Articles: `?sources=VITALMX,RACERX,MXVICE`
- Podcasts: `?shows=GYPSYTALES,PULPMXSHOW`
- Videos: `?channels=SWAPMOTOLIVE,VITALMX`

See [MULTI_SOURCE_API.md](MULTI_SOURCE_API.md) for complete implementation guide.

---

## 📞 Support

Questions? Contact the backend team or check:
- **Multi-Source Guide**: `MULTI_SOURCE_API.md` (NEW!)
- Full API docs in the repo: `PODCAST_API_DOCS.md`, `NEWS_API_DOCS.md`, `VIDEOS_API_DOCS.md`
- Base URL: `https://rss-feed-podcasts.vercel.app/api`

