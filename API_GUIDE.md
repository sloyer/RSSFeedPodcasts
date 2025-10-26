# RSS Feed Podcasts API - Complete Guide

## What This API Does

This API aggregates **motocross content** from multiple sources and provides a unified interface for:
- 📰 **News Articles** from motocross websites
- 🎙️ **Podcast Episodes** from motocross shows
- 📺 **YouTube Videos** from motocross channels

**Key Features:**
- ✅ Automatically fetches content every 15 minutes
- ✅ Deduplicates content (no duplicates)
- ✅ Provides discovery endpoints to find available sources
- ✅ Supports filtering by user-selected sources in a single API call
- ✅ Includes descriptions for each source
- ✅ Pagination and search across all content types

---

## Base URL

```
https://rss-feed-podcasts.vercel.app/api
```

---

## Quick Start

### 1. Discover Available Sources

Get all available content sources for your settings/preferences screen:

```javascript
// News sources
const news = await fetch('https://rss-feed-podcasts.vercel.app/api/news/sources');
// Returns: [{ source_name: "Vital MX", article_count: 150, description: "...", ... }]

// Podcast shows
const podcasts = await fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows');
// Returns: [{ show_name: "Gypsy Tales", episode_count: 45, description: "...", ... }]

// YouTube channels
const videos = await fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels');
// Returns: [{ channel_name: "Swapmoto Live", video_count: 23, description: "...", ... }]
```

### 2. User Selects Sources

User picks which sources they want in your app's settings.

### 3. Fetch Content from Selected Sources

**Single API call** with all selected sources:

```javascript
// News from multiple sources
const articles = await fetch(
  '/api/articles?sources=Vital MX,Racer X,MX Vice&limit=20'
);

// Podcasts from multiple shows
const episodes = await fetch(
  '/api/podcasts?shows=Gypsy Tales,The PulpMX.com Show&limit=20'
);

// Videos from multiple channels
const videos = await fetch(
  '/api/youtube?channels=Swapmoto Live,Vital MX&days=30&limit=20'
);
```

**Returns:** Combined, sorted content from all selected sources in a single response.

---

## API Endpoints Reference

### News Articles

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `GET /api/news/sources` | Discover available news sources | Returns all sources with counts |
| `GET /api/articles` | Get all articles | `?limit=20` |
| `GET /api/articles?sources=...` | Get articles from selected sources | `?sources=Vital MX,Racer X&limit=20` |
| `GET /api/articles?group_by_source=...` | Get articles from one source | `?group_by_source=VITALMX` |
| `GET /api/articles?search=...` | Search articles | `?search=supercross` |

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "Article Title",
      "excerpt": "Article summary...",
      "company": "Vital MX",
      "author": "John Smith",
      "published_date": "2025-10-26T10:00:00Z",
      "image_url": "https://...",
      "article_url": "https://vitalmx.com/..."
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

### Podcasts

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `GET /api/podcasts/shows` | Discover available podcast shows | Returns all shows with counts |
| `GET /api/podcasts` | Get all episodes | `?limit=20` |
| `GET /api/podcasts?shows=...` | Get episodes from selected shows | `?shows=Gypsy Tales,PulpMX Show&limit=20` |
| `GET /api/podcasts?podcast_name=...` | Get episodes from one show | `?podcast_name=Gypsy Tales` |
| `GET /api/podcasts?search=...` | Search episodes | `?search=interview` |

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "podcast_name": "Gypsy Tales",
      "podcast_title": "Episode 45: Season Recap",
      "podcast_description": "We discuss...",
      "podcast_date": "2025-10-21T10:00:00Z",
      "podcast_image": "https://...",
      "audio_url": "https://...mp3",
      "guid": "unique-episode-id"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 20
  }
}
```

---

### YouTube Videos

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `GET /api/videos/channels` | Discover available YouTube channels | Returns all channels with counts |
| `GET /api/youtube` | Get all videos | `?limit=20&days=30` |
| `GET /api/youtube?channels=...` | Get videos from selected channels | `?channels=Swapmoto Live,Vital MX&limit=20` |
| `GET /api/youtube?channel_id=...` | Get videos from one channel | `?channel_id=VITALMX` |
| `GET /api/youtube?search=...` | Search videos | `?search=highlights` |

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123xyz",
      "channelId": "UCxxxxx",
      "channelName": "Swapmoto Live",
      "title": "2025 Supercross Round 1 Highlights",
      "description": "Best moments...",
      "publishedAt": "2025-10-23T16:00:00Z",
      "thumbnailUrl": "https://img.youtube.com/...",
      "duration": "PT10M30S",
      "embedUrl": "https://www.youtube.com/embed/abc123xyz",
      "watchUrl": "https://www.youtube.com/watch?v=abc123xyz"
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

## Key Parameters

### Common Parameters (All Endpoints)

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Number of items to return | 20-50 |
| `offset` | integer | Pagination offset | 0 |
| `search` | string | Search in titles/descriptions | - |

### Multi-Source Parameters (Recommended)

| Parameter | Endpoint | Description | Example |
|-----------|----------|-------------|---------|
| `sources` | `/api/articles` | Comma-separated source names | `Vital MX,Racer X,MX Vice` |
| `shows` | `/api/podcasts` | Comma-separated show names | `Gypsy Tales,PulpMX Show` |
| `channels` | `/api/youtube` | Comma-separated channel names | `Swapmoto Live,Vital MX` |

### Video-Specific Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `days` | Number of days back to fetch videos | 7 |

---

## Discovery Endpoints (For Settings/Preferences)

These endpoints provide the source list for your app's settings screen.

### News Sources Discovery

```http
GET /api/news/sources
```

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "source_name": "Vital MX",
      "feed_name": "Vital MX RSS Feed",
      "article_count": 150,
      "latest_article_date": "2025-10-26T08:00:00Z",
      "source_image": "https://...",
      "description": "Latest motocross news from Vital MX",
      "has_articles": true
    }
  ],
  "total_sources": 10
}
```

**Use For:**
- Display available news sources in settings
- Show article counts
- Store `source_name` for filtering

---

### Podcast Shows Discovery

```http
GET /api/podcasts/shows
```

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "show_name": "Gypsy Tales",
      "episode_count": 45,
      "latest_episode_date": "2025-10-21T10:00:00Z",
      "show_image": "https://...",
      "description": "Motocross stories and interviews",
      "has_episodes": true
    }
  ],
  "total_shows": 12
}
```

**Use For:**
- Display available podcast shows in settings
- Show episode counts
- Store `show_name` for filtering

---

### YouTube Channels Discovery

```http
GET /api/videos/channels
```

**Returns:**
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
      "description": "Live motocross coverage and interviews",
      "has_videos": true
    }
  ],
  "total_channels": 8
}
```

**Use For:**
- Display available YouTube channels in settings
- Show video counts
- Store `channel_name` for filtering

---

## Multi-Source Filtering (Recommended Approach)

Fetch content from **multiple user-selected sources in a single API call**.

### Why Use Multi-Source Filtering?

**Before (Multiple API Calls):**
```javascript
// 3 separate API calls
const vital = await fetch('/api/articles?group_by_source=VITALMX&limit=10');
const racerx = await fetch('/api/articles?group_by_source=RACERX&limit=10');
const mxvice = await fetch('/api/articles?group_by_source=MXVICE&limit=10');

// Combine and sort client-side
const all = [...vital.data, ...racerx.data, ...mxvice.data];
all.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
```

**After (Single API Call):**
```javascript
// One call returns everything combined and sorted
const articles = await fetch('/api/articles?sources=Vital MX,Racer X,MX Vice&limit=20');
// Done! ✅
```

**Benefits:**
- ⚡ Faster (1 request instead of N)
- 📉 Less bandwidth
- 🎯 Server-side sorting
- 💻 Simpler code
- 🔋 Better battery life

---

### Articles Multi-Source

```http
GET /api/articles?sources=Vital MX,Racer X,MX Vice&limit=20
```

**URL Encoded:**
```
/api/articles?sources=Vital%20MX%2CRacer%20X%2CMX%20Vice&limit=20
```

**JavaScript:**
```javascript
const selectedSources = ["Vital MX", "Racer X", "MX Vice"];
const url = `/api/articles?sources=${encodeURIComponent(selectedSources.join(','))}&limit=20`;
```

---

### Podcasts Multi-Show

```http
GET /api/podcasts?shows=Gypsy Tales,The PulpMX.com Show&limit=20
```

**JavaScript:**
```javascript
const selectedShows = ["Gypsy Tales", "The PulpMX.com Show"];
const url = `/api/podcasts?shows=${encodeURIComponent(selectedShows.join(','))}&limit=20`;
```

---

### Videos Multi-Channel

```http
GET /api/youtube?channels=Swapmoto Live,Vital MX&days=30&limit=20
```

**JavaScript:**
```javascript
const selectedChannels = ["Swapmoto Live", "Vital MX"];
const url = `/api/youtube?channels=${encodeURIComponent(selectedChannels.join(','))}&days=30&limit=20`;
```

---

## Complete Implementation Example

### Settings/Preferences Screen

```javascript
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const [sources, setSources] = useState({
    news: [],
    podcasts: [],
    videos: []
  });
  
  const [selections, setSelections] = useState({
    news: [],
    podcasts: [],
    videos: []
  });

  // Load available sources
  useEffect(() => {
    const loadSources = async () => {
      const [newsRes, podcastsRes, videosRes] = await Promise.all([
        fetch('https://rss-feed-podcasts.vercel.app/api/news/sources'),
        fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows'),
        fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels')
      ]);

      const [newsData, podcastsData, videosData] = await Promise.all([
        newsRes.json(),
        podcastsRes.json(),
        videosRes.json()
      ]);

      setSources({
        news: newsData.data,
        podcasts: podcastsData.data,
        videos: videosData.data
      });
    };

    loadSources();
    loadSavedSelections();
  }, []);

  const loadSavedSelections = async () => {
    const saved = await AsyncStorage.getItem('content_selections');
    if (saved) setSelections(JSON.parse(saved));
  };

  const toggleSelection = (type, name) => {
    setSelections(prev => {
      const current = prev[type];
      const updated = {
        ...prev,
        [type]: current.includes(name)
          ? current.filter(n => n !== name)
          : [...current, name]
      };
      
      AsyncStorage.setItem('content_selections', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <ScrollView>
      <Text style={styles.header}>News Sources</Text>
      {sources.news.map(source => (
        <TouchableOpacity
          key={source.source_name}
          onPress={() => toggleSelection('news', source.source_name)}
          style={styles.sourceItem}
        >
          <Text>
            {selections.news.includes(source.source_name) ? '☑' : '☐'} 
            {source.source_name}
          </Text>
          <Text style={styles.description}>{source.description}</Text>
          <Text style={styles.meta}>
            {source.article_count} articles • 
            {source.latest_article_date 
              ? new Date(source.latest_article_date).toLocaleDateString()
              : 'No articles'}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.header}>Podcast Shows</Text>
      {sources.podcasts.map(show => (
        <TouchableOpacity
          key={show.show_name}
          onPress={() => toggleSelection('podcasts', show.show_name)}
          style={styles.sourceItem}
        >
          <Text>
            {selections.podcasts.includes(show.show_name) ? '☑' : '☐'} 
            {show.show_name}
          </Text>
          <Text style={styles.description}>{show.description}</Text>
          <Text style={styles.meta}>{show.episode_count} episodes</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.header}>YouTube Channels</Text>
      {sources.videos.map(channel => (
        <TouchableOpacity
          key={channel.channel_name}
          onPress={() => toggleSelection('videos', channel.channel_name)}
          style={styles.sourceItem}
        >
          <Text>
            {selections.videos.includes(channel.channel_name) ? '☑' : '☐'} 
            {channel.channel_name}
          </Text>
          <Text style={styles.description}>{channel.description}</Text>
          <Text style={styles.meta}>{channel.video_count} videos</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

---

### News Feed Screen

```javascript
const NewsFeedScreen = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    
    // Get user's selected sources
    const saved = await AsyncStorage.getItem('content_selections');
    const selections = JSON.parse(saved);
    
    if (!selections?.news || selections.news.length === 0) {
      setLoading(false);
      return; // Show empty state
    }

    // Single API call with all selected sources
    const sourcesParam = encodeURIComponent(selections.news.join(','));
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/articles?sources=${sourcesParam}&limit=20`
    );
    
    const data = await response.json();
    setArticles(data.data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadArticles();
    setRefreshing(false);
  };

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => (
        <ArticleCard
          title={item.title}
          source={item.company}
          excerpt={item.excerpt}
          image={item.image_url}
          url={item.article_url}
          date={item.published_date}
          author={item.author}
        />
      )}
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={<EmptyState message="No sources selected" />}
    />
  );
};
```

---

### Podcasts Feed Screen

```javascript
const PodcastsFeedScreen = () => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    
    const saved = await AsyncStorage.getItem('content_selections');
    const selections = JSON.parse(saved);
    
    if (!selections?.podcasts || selections.podcasts.length === 0) {
      setLoading(false);
      return;
    }

    const showsParam = encodeURIComponent(selections.podcasts.join(','));
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/podcasts?shows=${showsParam}&limit=20`
    );
    
    const data = await response.json();
    setEpisodes(data.data);
    setLoading(false);
  };

  return (
    <FlatList
      data={episodes}
      renderItem={({ item }) => (
        <PodcastEpisodeCard
          showName={item.podcast_name}
          title={item.podcast_title}
          description={item.podcast_description}
          image={item.podcast_image}
          audioUrl={item.audio_url}
          date={item.podcast_date}
        />
      )}
    />
  );
};
```

---

### Videos Feed Screen

```javascript
const VideosFeedScreen = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadVideos = async () => {
    setLoading(true);
    
    const saved = await AsyncStorage.getItem('content_selections');
    const selections = JSON.parse(saved);
    
    if (!selections?.videos || selections.videos.length === 0) {
      setLoading(false);
      return;
    }

    const channelsParam = encodeURIComponent(selections.videos.join(','));
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/youtube?channels=${channelsParam}&days=30&limit=20`
    );
    
    const data = await response.json();
    setVideos(data.data);
    setLoading(false);
  };

  return (
    <FlatList
      data={videos}
      renderItem={({ item }) => (
        <VideoCard
          channelName={item.channelName}
          title={item.title}
          thumbnail={item.thumbnailUrl}
          embedUrl={item.embedUrl}
          watchUrl={item.watchUrl}
          duration={item.duration}
          date={item.publishedAt}
        />
      )}
    />
  );
};
```

---

## Pagination

All endpoints support pagination:

```javascript
// Page 1
GET /api/articles?sources=Vital MX&limit=20&offset=0

// Page 2
GET /api/articles?sources=Vital MX&limit=20&offset=20

// Page 3
GET /api/articles?sources=Vital MX&limit=20&offset=40
```

**Infinite Scroll:**
```javascript
const [articles, setArticles] = useState([]);
const [offset, setOffset] = useState(0);
const limit = 20;

const loadMore = async () => {
  const response = await fetch(
    `/api/articles?sources=${sourcesParam}&limit=${limit}&offset=${offset}`
  );
  const data = await response.json();
  
  setArticles(prev => [...prev, ...data.data]);
  setOffset(prev => prev + limit);
};
```

---

## Search

All content endpoints support search:

```javascript
// Search all articles
GET /api/articles?search=supercross&limit=20

// Search within selected sources
GET /api/articles?sources=Vital MX,Racer X&search=supercross&limit=20

// Search podcasts
GET /api/podcasts?shows=Gypsy Tales&search=interview&limit=20

// Search videos
GET /api/youtube?channels=Swapmoto Live&search=highlights&days=30&limit=20
```

---

## What This API Can Do

### ✅ Content Aggregation
- Fetches from multiple RSS feeds automatically every 15 minutes
- Fetches from YouTube channels every 15 minutes
- Deduplicates content (no repeats)
- Filters out old content (podcasts: 2025+, articles: configurable)

### ✅ Image Handling
- Extracts images from various RSS formats
- Filters out ads and tracking pixels
- Converts `http://` to `https://` for mobile compatibility
- Falls back gracefully when no image available

### ✅ Discovery & Filtering
- Discovery endpoints show all available sources
- Multi-source filtering in single API calls
- User preference support
- Real-time content counts

### ✅ Search & Pagination
- Search across titles and descriptions
- Paginated results (customizable limit/offset)
- Sorted by date (newest first)
- Combined results from multiple sources

### ✅ Performance
- Fast response times (~200-500ms for discovery)
- Optimized queries (no N+1 problems)
- ETag caching to avoid unnecessary fetching
- Bulk operations for efficiency

---

## Error Handling

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

**Always check `success` field:**
```javascript
const response = await fetch('/api/articles?sources=Vital MX');
const data = await response.json();

if (data.success) {
  // Handle data
  setArticles(data.data);
} else {
  // Handle error
  console.error(data.error);
}
```

---

## CORS Support

All endpoints have CORS enabled:
```
Access-Control-Allow-Origin: *
```

Safe to call from any web or mobile app.

---

## Rate Limiting

Currently **no rate limiting** is enforced. Use responsibly.

---

## Data Freshness

### Automatic Updates
- **Cron job runs every 15 minutes**
- Fetches new content automatically
- Updates stored in database
- Apps get fresh data on each request

### Manual Trigger
For admins only (requires `CRON_SECRET`):
```bash
curl -X GET "https://rss-feed-podcasts.vercel.app/api/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Advanced Features

### Combine Multiple Content Types

```javascript
// Fetch all content types in parallel
const [articles, episodes, videos] = await Promise.all([
  fetch('/api/articles?sources=Vital MX,Racer X&limit=10'),
  fetch('/api/podcasts?shows=Gypsy Tales&limit=10'),
  fetch('/api/youtube?channels=Swapmoto Live&days=7&limit=10')
]);

// Create unified feed
const allContent = [
  ...articles.data.map(a => ({ ...a, type: 'article' })),
  ...episodes.data.map(e => ({ ...e, type: 'podcast' })),
  ...videos.data.map(v => ({ ...v, type: 'video' }))
];

// Sort by date
allContent.sort((a, b) => {
  const dateA = new Date(a.published_date || a.podcast_date || a.publishedAt);
  const dateB = new Date(b.published_date || b.podcast_date || b.publishedAt);
  return dateB - dateA;
});
```

---

## Available Content Sources

### News Sources (Active)
Check `/api/news/sources` for current list. Common sources include:
- Vital MX
- Racer X
- MX Vice
- Motocross Action
- Australian Supercross Official
- Transworld MX

### Podcast Shows (Active)
Check `/api/podcasts/shows` for current list. Common shows include:
- Gypsy Tales
- The PulpMX.com Show
- Vital MX
- Industry Seating
- Swapmoto Live Podcast
- The AC & JB Show

### YouTube Channels (Active)
Check `/api/videos/channels` for current list. Common channels include:
- Swapmoto Live
- Vital MX
- MX Vice
- And more...

---

## Best Practices

### 1. Cache Discovery Data
```javascript
// Cache discovery data for 24 hours
const cacheKey = 'discovery_data';
const cached = await AsyncStorage.getItem(cacheKey);
const cacheTime = await AsyncStorage.getItem(`${cacheKey}_time`);

if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 86400000) {
  // Use cached data (< 24 hours old)
  return JSON.parse(cached);
} else {
  // Fetch fresh data
  const data = await fetchDiscoveryData();
  await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
  await AsyncStorage.setItem(`${cacheKey}_time`, Date.now().toString());
}
```

### 2. Handle Empty States
```javascript
if (!selections?.news || selections.news.length === 0) {
  return <EmptyState message="Select news sources in Settings" />;
}
```

### 3. URL Encoding
Always encode source names (they contain spaces):
```javascript
const url = `/api/articles?sources=${encodeURIComponent(sources.join(','))}`;
```

### 4. Error Handling
```javascript
try {
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  setArticles(data.data);
} catch (error) {
  console.error('Failed to load articles:', error);
  showErrorToast('Failed to load content');
}
```

### 5. Pull to Refresh
```javascript
<FlatList
  data={articles}
  onRefresh={loadArticles}
  refreshing={loading}
  // ... other props
/>
```

---

## Troubleshooting

### No Images Showing
- Check if `image_url` is present in response
- Verify your app allows `https://` images
- Some articles may not have images (API returns empty string)

### No Results
- Verify source names match exactly (case-sensitive)
- Check if sources are active: `has_articles`, `has_episodes`, `has_videos` in discovery endpoints
- URL encode source names with spaces

### Slow Performance
- Use multi-source filtering instead of multiple API calls
- Implement pagination (don't fetch all at once)
- Cache discovery data (changes infrequently)

---

## Summary

### For Settings Screen:
1. Call discovery endpoints: `/api/news/sources`, `/api/podcasts/shows`, `/api/videos/channels`
2. Display sources with descriptions and counts
3. Save user selections locally

### For Feed Screens:
1. Load user selections from storage
2. Make single API call with multi-source parameters:
   - `?sources=Source1,Source2,Source3`
   - `?shows=Show1,Show2`
   - `?channels=Channel1,Channel2`
3. Display results (already filtered, sorted, and combined)

### Key URLs:
```
Discovery:
- GET /api/news/sources
- GET /api/podcasts/shows
- GET /api/videos/channels

Content (Multi-Source):
- GET /api/articles?sources=Vital MX,Racer X&limit=20
- GET /api/podcasts?shows=Gypsy Tales,PulpMX Show&limit=20
- GET /api/youtube?channels=Swapmoto Live,Vital MX&limit=20
```

---

## Additional Documentation

- **Multi-Source Usage**: See `MULTI_SOURCE_USAGE.md`
- **App Integration**: See `APP_INTEGRATION_GUIDE.md`
- **Detailed API Docs**: See `NEWS_API_DOCS.md`, `PODCAST_API_DOCS.md`, `VIDEOS_API_DOCS.md`

