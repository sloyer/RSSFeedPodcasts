# Multi-Source API Usage Guide

## Summary

The API now supports fetching content from **multiple user-selected sources in a single API call**. The app gets available feeds from discovery endpoints, user selects which ones they want, and the app sends those selections back to get combined, sorted content.

---

## How It Works

### Step 1: Get Available Feeds (Settings Page)

```javascript
// Fetch available sources for user to select
const newsResponse = await fetch('https://rss-feed-podcasts.vercel.app/api/news/sources');
const podcastsResponse = await fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows');
const videosResponse = await fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels');

// Response includes source_name, show_name, or channel_name
const newsSources = newsResponse.data;
// [{ source_name: "Vital MX", article_count: 150, ... }, ...]
```

### Step 2: User Selects Feeds

User checks/unchecks feeds in settings:
- ☑ Vital MX
- ☑ Racer X
- ☑ MX Vice
- ☐ Motocross Action

App stores selected names:
```javascript
const selectedNews = ["Vital MX", "Racer X", "MX Vice"];
const selectedPodcasts = ["Gypsy Tales", "The PulpMX.com Show"];
const selectedVideos = ["Swapmoto Live", "Vital MX"];
```

### Step 3: Fetch Content Using Selections

**Single API call per content type with all selected sources:**

```javascript
// News - all selected sources in one call
const newsUrl = `/api/articles?sources=${encodeURIComponent(selectedNews.join(','))}&limit=20`;
const articles = await fetch(newsUrl);
// Returns 20 articles from Vital MX, Racer X, and MX Vice combined & sorted

// Podcasts - all selected shows in one call
const podcastUrl = `/api/podcasts?shows=${encodeURIComponent(selectedPodcasts.join(','))}&limit=20`;
const episodes = await fetch(podcastUrl);
// Returns 20 episodes from Gypsy Tales and PulpMX Show combined & sorted

// Videos - all selected channels in one call
const videoUrl = `/api/youtube?channels=${encodeURIComponent(selectedVideos.join(','))}&days=30&limit=20`;
const videos = await fetch(videoUrl);
// Returns 20 videos from Swapmoto Live and Vital MX combined & sorted
```

---

## API Parameters

| Content Type | Discovery Endpoint | Multi-Source Parameter | Example |
|--------------|-------------------|------------------------|---------|
| **News** | `/api/news/sources` | `sources` | `?sources=Vital MX,Racer X,MX Vice` |
| **Podcasts** | `/api/podcasts/shows` | `shows` | `?shows=Gypsy Tales,The PulpMX.com Show` |
| **Videos** | `/api/videos/channels` | `channels` | `?channels=Swapmoto Live,Vital MX` |

---

## Complete Example

```javascript
// ============================================
// Settings Screen - User Selection
// ============================================

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const [availableSources, setAvailableSources] = useState({
    news: [],
    podcasts: [],
    videos: []
  });
  
  const [selections, setSelections] = useState({
    news: [],
    podcasts: [],
    videos: []
  });

  useEffect(() => {
    loadAvailableSources();
    loadSavedSelections();
  }, []);

  const loadAvailableSources = async () => {
    const [news, podcasts, videos] = await Promise.all([
      fetch('https://rss-feed-podcasts.vercel.app/api/news/sources').then(r => r.json()),
      fetch('https://rss-feed-podcasts.vercel.app/api/podcasts/shows').then(r => r.json()),
      fetch('https://rss-feed-podcasts.vercel.app/api/videos/channels').then(r => r.json())
    ]);

    setAvailableSources({
      news: news.data,
      podcasts: podcasts.data,
      videos: videos.data
    });
  };

  const loadSavedSelections = async () => {
    const saved = await AsyncStorage.getItem('feed_selections');
    if (saved) {
      setSelections(JSON.parse(saved));
    }
  };

  const toggleSelection = (type, name) => {
    setSelections(prev => {
      const current = prev[type];
      const newSelection = current.includes(name)
        ? current.filter(n => n !== name)
        : [...current, name];
      
      const updated = { ...prev, [type]: newSelection };
      
      // Save to storage
      AsyncStorage.setItem('feed_selections', JSON.stringify(updated));
      
      return updated;
    });
  };

  return (
    <ScrollView>
      <Text>News Sources</Text>
      {availableSources.news.map(source => (
        <TouchableOpacity
          key={source.source_name}
          onPress={() => toggleSelection('news', source.source_name)}
        >
          <Text>
            {selections.news.includes(source.source_name) ? '☑' : '☐'}
            {source.source_name} ({source.article_count} articles)
          </Text>
        </TouchableOpacity>
      ))}
      
      {/* Similar for podcasts and videos */}
    </ScrollView>
  );
};

// ============================================
// Feed Screen - Display Content
// ============================================

const NewsFeedScreen = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    
    // Get user's selected sources
    const saved = await AsyncStorage.getItem('feed_selections');
    const selections = JSON.parse(saved);
    
    if (!selections?.news || selections.news.length === 0) {
      setLoading(false);
      return; // No sources selected
    }

    // Single API call with all selected sources
    const sourcesParam = encodeURIComponent(selections.news.join(','));
    const url = `https://rss-feed-podcasts.vercel.app/api/articles?sources=${sourcesParam}&limit=20`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    setArticles(data.data); // Already filtered, sorted, and combined!
    setLoading(false);
  };

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => (
        <View>
          <Text>{item.title}</Text>
          <Text>{item.company}</Text>
          <Text>{new Date(item.published_date).toLocaleDateString()}</Text>
        </View>
      )}
      onRefresh={loadArticles}
      refreshing={loading}
    />
  );
};

// Same pattern for PodcastsFeedScreen and VideosFeedScreen
```

---

## What Changed

### Backend Changes

1. **Discovery endpoints unchanged** - still return `source_name`, `show_name`, `channel_name`
2. **Added multi-source parameters:**
   - `/api/articles` now accepts `?sources=Vital MX,Racer X,MX Vice`
   - `/api/podcasts` now accepts `?shows=Gypsy Tales,The PulpMX.com Show`
   - `/api/youtube` now accepts `?channels=Swapmoto Live,Vital MX`
3. **Backend handles:**
   - Splitting comma-separated names
   - Filtering to only those sources
   - Sorting by date
   - Returning combined results

### App Changes Needed

**Before (multiple calls):**
```javascript
// Had to make separate calls
const vital = await fetch('/api/articles?group_by_source=VITALMX&limit=10');
const racerx = await fetch('/api/articles?group_by_source=RACERX&limit=10');
const mxvice = await fetch('/api/articles?group_by_source=MXVICE&limit=10');

// Combine client-side
const all = [...vital.data, ...racerx.data, ...mxvice.data];
all.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
```

**After (single call):**
```javascript
// One call does everything
const sources = ['Vital MX', 'Racer X', 'MX Vice'];
const url = `/api/articles?sources=${encodeURIComponent(sources.join(','))}&limit=20`;
const response = await fetch(url);
const articles = response.data; // Done!
```

---

## Benefits

- ⚡ **1 API call instead of N calls** (where N = number of selected sources)
- 📉 **Less data transfer** - server limits to 20 total, not 20 per source
- 🎯 **Accurate sorting** - server sorts all results together by date
- 💻 **Simpler code** - no client-side merging/sorting needed
- 🔋 **Better performance** - fewer network requests

---

## URL Encoding

Always use `encodeURIComponent` when source names have spaces or special characters:

```javascript
const sources = ["Vital MX", "Racer X", "MX Vice"];

// ✅ Correct
const url = `/api/articles?sources=${encodeURIComponent(sources.join(','))}`;
// Result: /api/articles?sources=Vital%20MX%2CRacer%20X%2CMX%20Vice

// ❌ Wrong (spaces will break)
const url = `/api/articles?sources=${sources.join(',')}`;
// Result: /api/articles?sources=Vital MX,Racer X,MX Vice (broken)
```

Or use `URLSearchParams`:
```javascript
const params = new URLSearchParams({
  sources: sources.join(','),
  limit: 20
});
const url = `/api/articles?${params}`;
```

