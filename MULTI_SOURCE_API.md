# Multi-Source Filtering API

## Overview

The API now supports fetching content from **multiple user-selected sources in a single API call**, eliminating the need for multiple requests or client-side filtering.

## How It Works

### Complete User Flow

```
1. Discovery → 2. Selection → 3. Extract API Codes → 4. Single API Call
```

**Step 1: Discovery** - App calls discovery endpoints to get available sources  
**Step 2: User Selection** - User selects which sources they want (checkboxes in settings)  
**Step 3: Extract API Codes** - App extracts `api_code` from selected sources  
**Step 4: Fetch Content** - Single API call with all selected sources

---

## News Articles

### Discovery Endpoint

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
      "description": "Latest motocross news from Vital MX",
      "endpoint_url": "/api/articles?group_by_source=VITALMX"
    },
    {
      "source_name": "Racer X",
      "feed_name": "Racer X Online",
      "article_count": 89,
      "description": "Racer X coverage",
      "endpoint_url": "/api/articles?group_by_source=RACERX"
    },
    {
      "source_name": "MX Vice",
      "article_count": 45,
      "description": "MX Vice news",
      "endpoint_url": "/api/articles?group_by_source=MXVICE"
    }
  ]
}
```

### Multi-Source Filtering

```http
GET /api/articles?sources=Vital MX,Racer X,MX Vice&limit=20
```

**Parameters:**
- `sources` - Comma-separated list of source names (URL encoded)
- `limit` - Number of articles to return (default: 20)
- `offset` - Pagination offset (default: 0)
- `search` - Search keyword (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "2025 Supercross Preview",
      "company": "Vital MX",
      "published_date": "2025-10-26T10:00:00Z",
      "excerpt": "Season preview...",
      "url": "https://vitalmx.com/...",
      "image_url": "https://..."
    },
    {
      "id": 124,
      "title": "Race Highlights",
      "company": "Racer X",
      "published_date": "2025-10-26T09:30:00Z",
      "excerpt": "Best moments...",
      "url": "https://racerx.com/...",
      "image_url": "https://..."
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "count": 20
  }
}
```

**Articles are automatically:**
- Filtered to only selected sources
- Sorted by `published_date` (newest first)
- Combined from all sources

---

## Podcasts

### Discovery Endpoint

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
      "description": "Motocross stories and interviews",
      "latest_episode_date": "2025-10-21T10:00:00Z",
      "endpoint_url": "/api/podcasts?podcast_name=Gypsy%20Tales"
    },
    {
      "show_name": "The PulpMX.com Show",
      "episode_count": 67,
      "description": "Weekly motocross podcast",
      "latest_episode_date": "2025-10-20T12:00:00Z",
      "endpoint_url": "/api/podcasts?podcast_name=The%20PulpMX.com%20Show"
    }
  ]
}
```

### Multi-Show Filtering

```http
GET /api/podcasts?shows=Gypsy Tales,The PulpMX.com Show&limit=20
```

**Parameters:**
- `shows` - Comma-separated list of show names (URL encoded)
- `limit` - Number of episodes to return (default: 50)
- `offset` - Pagination offset (default: 0)
- `search` - Search keyword (optional)

**Response:**
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
      "audio_url": "https://...mp3"
    },
    {
      "id": 457,
      "podcast_name": "The PulpMX.com Show",
      "podcast_title": "Show 567",
      "podcast_description": "This week...",
      "podcast_date": "2025-10-20T12:00:00Z",
      "podcast_image": "https://...",
      "audio_url": "https://...mp3"
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

## YouTube Videos

### Discovery Endpoint

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
      "description": "Live motocross coverage and interviews",
      "latest_video_date": "2025-10-23T16:00:00Z",
      "endpoint_url": "/api/youtube?channel_id=SWAPMOTOLIVE"
    },
    {
      "channel_name": "Vital MX",
      "channel_id": "UCyyyyy",
      "video_count": 34,
      "description": "Vital MX video content",
      "latest_video_date": "2025-10-22T09:00:00Z",
      "endpoint_url": "/api/youtube?channel_id=VITALMX"
    }
  ]
}
```

### Multi-Channel Filtering

```http
GET /api/youtube?channels=Swapmoto Live,Vital MX&days=30&limit=20
```

**Parameters:**
- `channels` - Comma-separated list of channel names (URL encoded)
- `limit` - Number of videos to return (default: 20)
- `offset` - Pagination offset (default: 0)
- `days` - Days back to fetch (default: 7)
- `search` - Search keyword (optional)

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
      "publishedAt": "2025-10-23T16:00:00Z",
      "thumbnailUrl": "https://img.youtube.com/...",
      "embedUrl": "https://www.youtube.com/embed/abc123xyz",
      "watchUrl": "https://www.youtube.com/watch?v=abc123xyz"
    },
    {
      "id": "def456uvw",
      "channelId": "UCyyyyy",
      "channelName": "Vital MX",
      "title": "Track Walk",
      "publishedAt": "2025-10-22T14:00:00Z",
      "thumbnailUrl": "https://img.youtube.com/...",
      "embedUrl": "https://www.youtube.com/embed/def456uvw",
      "watchUrl": "https://www.youtube.com/watch?v=def456uvw"
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

## Implementation Examples

### React Native / JavaScript

```javascript
// ============================================
// STEP 1: Discovery - Get Available Sources
// ============================================

const [availableSources, setAvailableSources] = useState({
  news: [],
  podcasts: [],
  videos: []
});

// Fetch all available sources
const fetchAvailableSources = async () => {
  const [newsRes, podcastsRes, videosRes] = await Promise.all([
    fetch('https://rss-feed-podcasts.vercel.app/api/news/sources'),
    fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows'),
    fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels')
  ]);

  const newsData = await newsRes.json();
  const podcastsData = await podcastsRes.json();
  const videosData = await videosRes.json();

  setAvailableSources({
    news: newsData.data,
    podcasts: podcastsData.data,
    videos: videosData.data
  });
};

// ============================================
// STEP 2: User Selection (Settings Screen)
// ============================================

const SettingsScreen = () => {
  const [selectedSources, setSelectedSources] = useState({
    news: [],
    podcasts: [],
    videos: []
  });

  const toggleSource = (type, source) => {
    setSelectedSources(prev => ({
      ...prev,
      [type]: prev[type].includes(source.api_code)
        ? prev[type].filter(code => code !== source.api_code)
        : [...prev[type], source.api_code]
    }));
  };

  return (
    <View>
      <Text>News Sources</Text>
      {availableSources.news.map(source => (
        <TouchableOpacity
          key={source.api_code}
          onPress={() => toggleSource('news', source)}
        >
          <Text>
            {selectedSources.news.includes(source.api_code) ? '☑' : '☐'}
            {source.source_name} ({source.article_count} articles)
          </Text>
          <Text>{source.description}</Text>
        </TouchableOpacity>
      ))}
      
      {/* Similar for podcasts and videos */}
      
      <Button title="Save" onPress={() => savePreferences(selectedSources)} />
    </View>
  );
};

// ============================================
// STEP 3 & 4: Fetch Content from Selected Sources
// ============================================

const NewsFeedScreen = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    // Get user's selected news sources
    const prefs = await AsyncStorage.getItem('user_preferences');
    const preferences = JSON.parse(prefs);
    
    if (preferences.news.length === 0) {
      // No sources selected, show empty state
      setLoading(false);
      return;
    }

    // Single API call with all selected sources
    const sourcesParam = preferences.news.join(',');
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/articles?sources=${sourcesParam}&limit=20`
    );
    
    const data = await response.json();
    setArticles(data.data); // Already filtered, sorted, and combined!
    setLoading(false);
  };

  return (
    <FlatList
      data={articles}
      renderItem={({ item }) => (
        <ArticleCard
          title={item.title}
          source={item.company}
          excerpt={item.excerpt}
          image={item.image_url}
          date={item.published_date}
        />
      )}
      onRefresh={loadArticles}
      refreshing={loading}
    />
  );
};

// Same pattern for podcasts and videos
const PodcastsFeedScreen = () => {
  const loadEpisodes = async () => {
    const prefs = JSON.parse(await AsyncStorage.getItem('user_preferences'));
    const showsParam = prefs.podcasts.join(',');
    
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/podcasts?shows=${showsParam}&limit=20`
    );
    // ...
  };
};

const VideosFeedScreen = () => {
  const loadVideos = async () => {
    const prefs = JSON.parse(await AsyncStorage.getItem('user_preferences'));
    const channelsParam = prefs.videos.join(',');
    
    const response = await fetch(
      `https://rss-feed-podcasts.vercel.app/api/youtube?channels=${channelsParam}&days=30&limit=20`
    );
    // ...
  };
};
```

---

## URL Encoding

Since source/show/channel names may contain spaces and special characters, make sure to URL encode them:

```javascript
// JavaScript
const selectedSources = ["Vital MX", "Racer X", "MX Vice"];
const url = `/api/articles?sources=${encodeURIComponent(selectedSources.join(','))}`;
// Result: /api/articles?sources=Vital%20MX%2CRacer%20X%2CMX%20Vice

// Or encode the entire parameter
const params = new URLSearchParams({
  sources: selectedSources.join(','),
  limit: 20
});
const url = `/api/articles?${params}`;
```

---

## Backwards Compatibility

All existing parameters still work:

### Articles
- ✅ `GET /api/articles?group_by_source=VITALMX` (single source)
- ✅ `GET /api/articles?company=Vital MX` (legacy)
- ✅ `GET /api/articles?sources=VITALMX,RACERX` (NEW - multi-source)

### Podcasts
- ✅ `GET /api/podcasts?podcast_name=Gypsy Tales` (single show)
- ✅ `GET /api/podcasts?group_by_show=GYPSYTALES` (single show)
- ✅ `GET /api/podcasts?shows=GYPSYTALES,PULPMXSHOW` (NEW - multi-show)

### Videos
- ✅ `GET /api/youtube?channel_id=VITALMX` (single channel)
- ✅ `GET /api/youtube?channels=VITALMX,SWAPMOTOLIVE` (NEW - multi-channel)

---

## Benefits

### Before (Old Approach)

**Multiple API Calls:**
```javascript
// Make 3 separate API calls
const vital = await fetch('/api/articles?group_by_source=VITALMX&limit=10');
const racerx = await fetch('/api/articles?group_by_source=RACERX&limit=10');
const mxvice = await fetch('/api/articles?group_by_source=MXVICE&limit=10');

// Combine results
const all = [...vital.data, ...racerx.data, ...mxvice.data];

// Sort by date
all.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));

// Get top 20
const top20 = all.slice(0, 20);
```

**OR Client-Side Filtering:**
```javascript
// Fetch everything
const all = await fetch('/api/articles?limit=100');

// Filter to user's selections
const filtered = all.data.filter(article => 
  ['Vital MX', 'Racer X', 'MX Vice'].includes(article.company)
);

// Already sorted, get top 20
const top20 = filtered.slice(0, 20);
```

### After (New Approach)

**Single API Call:**
```javascript
// One call, server does everything
const response = await fetch('/api/articles?sources=VITALMX,RACERX,MXVICE&limit=20');
const articles = response.data; // Done! ✅
```

**Benefits:**
- ⚡ **Faster** - Single network request
- 📉 **Less data transfer** - Server filters before sending
- 🎯 **More accurate** - Server handles sorting/limiting correctly
- 💻 **Simpler code** - No client-side combining/sorting
- 🔋 **Battery friendly** - Fewer network calls

---

## Testing

```bash
# Test news multi-source
curl "https://rss-feed-podcasts.vercel.app/api/articles?sources=VITALMX,RACERX&limit=5"

# Test podcasts multi-show
curl "https://rss-feed-podcasts.vercel.app/api/podcasts?shows=GYPSYTALES,PULPMXSHOW&limit=5"

# Test videos multi-channel
curl "https://rss-feed-podcasts.vercel.app/api/youtube?channels=SWAPMOTOLIVE,VITALMX&days=7&limit=5"
```

---

## Summary

| Content Type | Parameter | Example |
|--------------|-----------|---------|
| **Articles** | `sources` | `?sources=VITALMX,RACERX,MXVICE` |
| **Podcasts** | `shows` | `?shows=GYPSYTALES,PULPMXSHOW` |
| **Videos** | `channels` | `?channels=SWAPMOTOLIVE,VITALMX` |

**All parameters accept comma-separated API codes from the discovery endpoints.**

