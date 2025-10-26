# 🎙️ Podcast API Endpoints Documentation

## Base URL
```
https://rss-feed-podcasts.vercel.app/api
```

## How the System Works

### Two-Table Architecture

The podcast system uses **two separate tables** that work together:

#### 1. **`rss_feeds` Table** - Feed Configuration
- **Purpose:** Stores RSS feed sources and configuration
- **Contains:** Feed URLs, feed names, active status
- **Function:** Defines what podcast shows are available to fetch
- **Access via:** `/api/feed-sources?type=podcasts`

#### 2. **`podcasts` Table** - Episode Storage  
- **Purpose:** Stores actual podcast episodes and metadata
- **Contains:** Episode titles, descriptions, audio URLs, publish dates
- **Function:** Holds the fetched episode data from RSS feeds
- **Access via:** `/api/podcasts` (all endpoints below)

### Data Flow
```
RSS Feeds → Cron Job → `rss_feeds` table → Fetch Episodes → `podcasts` table → API Endpoints
```

1. **Configure feeds** in `rss_feeds` table
2. **Cron job runs** every 15 minutes (`/api/cron`)
3. **Episodes fetched** from active RSS feeds
4. **Episodes stored** in `podcasts` table  
5. **API serves episodes** from `podcasts` table

## Core Podcast Endpoints

### 1. **Get All Episodes** 
```http
GET /api/podcasts
```

**Default Behavior:**
- Returns latest 50 episodes across all shows
- Sorted by publish date (newest first)
- Flat list format

**Basic Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "podcast_name": "The PulpMX.com Show",
      "podcast_title": "Episode Title",
      "podcast_description": "Episode description...",
      "podcast_date": "2025-01-15T10:00:00Z",
      "podcast_image": "https://...",
      "audio_url": "https://...",
      "feed_url": "https://...",
      "guid": "unique-episode-id"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 50
  },
  "grouped_by_show": false
}
```

---

### 2. **Discover Available Shows**
```http
GET /api/podcasts/shows
```

**Purpose:** Get all available podcast shows with metadata for app consumption

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "show_name": "Vital MX",
      "episode_count": 50,
      "latest_episode_date": "2025-09-21T08:00:00Z",
      "show_image": "https://...",
      "endpoint_url": "/api/podcasts?podcast_name=Vital%20MX",
      "description": "Vital MX Podcast",
      "has_episodes": true
    },
    {
      "show_name": "Title 24",
      "episode_count": 0,
      "latest_episode_date": null,
      "show_image": null,
      "endpoint_url": "/api/podcasts?podcast_name=Title%2024",
      "description": "Title 24 - Villopoto & Carmichael", 
      "has_episodes": false
    }
  ],
  "total_shows": 12
}
```

**Shows all configured feeds:**
- ✅ **Shows with episodes** (sorted by latest episode date)
- ✅ **Shows without episodes** (episode_count: 0, has_episodes: false)
- ✅ **Ready-to-use URLs** for all shows

---

### 3. **Get Episodes by Specific Show**
```http
GET /api/podcasts?group_by_show={API_CODE}
```

**API Code Generation:** Take the show name, uppercase it, remove all non-alphanumeric characters
- `"The PulpMX.com Show"` → `THEPULPMXCOMSHOW`
- `"Gypsy Tales"` → `GYPSYTALES`
- `"The AC & JB Show"` → `THEACJBSHOW`

**Example:**
```http
GET /api/podcasts?group_by_show=GYPSYTALES
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "podcast_name": "Gypsy Tales",
      "podcast_title": "Latest Episode",
      // ... other episode fields
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 12 },
  "grouped_by_show": false
}
```

---

### 4. **Get Shows Organized by Show**
```http
GET /api/podcasts?group_by_show=true
```

**Purpose:** Get episodes organized by show with metadata

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "show_name": "The PulpMX.com Show",
      "show_image": "https://...",
      "feed_url": "https://...",
      "episode_count": 15,
      "latest_episode_date": "2025-01-15T10:00:00Z",
      "episodes": [
        {
          "id": 123,
          "title": "Episode Title",
          "description": "Description...",
          "published_date": "2025-01-15T10:00:00Z",
          "image_url": "https://...",
          "audio_url": "https://...",
          "guid": "unique-id"
        }
      ]
    }
  ],
  "total_shows": 6,
  "grouped_by_show": true
}
```

---

## Query Parameters

### **Pagination**
```http
GET /api/podcasts?limit=20&offset=40
```
- `limit`: Number of episodes to return (default: 50)
- `offset`: Number of episodes to skip (default: 0)

### **Search**
```http
GET /api/podcasts?search=keyword
```
- Searches in episode titles and descriptions
- Case insensitive

### **Multi-Show Filter** ⭐ NEW
```http
GET /api/podcasts?shows=GYPSYTALES,PULPMXSHOW,VITALMX&limit=20
```
- **Single API call** to fetch episodes from multiple shows
- `shows`: Comma-separated list of show API codes
- Get API codes from `/api/podcasts/shows` (includes `api_code` field)
- Server-side filtering, sorting, and combining
- **Recommended for user-selected shows**

**Example:**
```javascript
// Get shows user selected
const apiCodes = ['GYPSYTALES', 'PULPMXSHOW', 'VITALMX'];
const url = `/api/podcasts?shows=${apiCodes.join(',')}&limit=20`;
// Single call returns filtered, sorted episodes from all 3 shows
```

See [MULTI_SOURCE_API.md](MULTI_SOURCE_API.md) for complete guide.

### **Combined Parameters**
```http
GET /api/podcasts?group_by_show=GYPSYTALES&limit=10&search=motocross
```

---

## Discovery Endpoints

### **Get Available Show Sources**
```http
GET /api/feed-sources?type=podcasts
```

**Purpose:** Get all configured podcast feeds with API codes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Gypsy Tales",
      "apiCode": "GYPSYTALES",
      "url": "https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=GYPSYTALES",
      "logo": "https://via.placeholder.com/100x100/9C27B0/FFFFFF?text=G",
      "category": "Podcasts",
      "enabled": false,
      "type": "podcasts",
      "priority": 1
    }
  ],
  "type": "podcasts"
}
```

---

## Common Use Cases

### **1. App Discovery Flow (Recommended)**
```http
# Step 1: Discover available shows
GET /api/podcasts/shows

# Step 2: Use endpoint_url from response  
GET /api/podcasts?podcast_name=Vital%20MX
```

### **2. Get Latest Episodes Across All Shows**
```http
GET /api/podcasts?limit=20
```

### **3. Get All Episodes from One Show**
```http
GET /api/podcasts?podcast_name=The%20PulpMX.com%20Show
```

### **4. Get Shows with Episode Counts**
```http
GET /api/podcasts?group_by_show=true
```

### **5. Search Specific Show**
```http
GET /api/podcasts?podcast_name=Vital%20MX&search=interview
```

### **6. Paginate Through Episodes**
```http
GET /api/podcasts?limit=10&offset=0    # First page
GET /api/podcasts?limit=10&offset=10   # Second page
GET /api/podcasts?limit=10&offset=20   # Third page
```

---

## Response Format Notes

**Episode Fields:**
- `id`: Unique episode identifier
- `podcast_name`: Show name
- `podcast_title`: Episode title
- `podcast_description`: Episode description
- `podcast_date`: Publication date (ISO 8601)
- `podcast_image`: Episode/show artwork URL
- `audio_url`: Direct audio file URL
- `feed_url`: Original RSS feed URL
- `guid`: Unique episode GUID

**Pagination:**
- Always includes `pagination` object with current `limit`, `offset`, and actual `count` returned
- `count` may be less than `limit` if fewer episodes are available

**Error Handling:**
- HTTP 200: Success
- HTTP 400: Bad request (invalid parameters)
- HTTP 500: Server error
- All errors include `{ "success": false, "error": "message" }`

---

## Quick Reference

| Endpoint | Purpose | Key Parameters |
|----------|---------|----------------|
| `/api/podcasts` | Get all episodes | `limit`, `offset`, `search` |
| `/api/podcasts?debug_shows=true` | List available shows | None |
| `/api/podcasts?group_by_show={CODE}` | Get specific show episodes | API code from show name |
| `/api/podcasts?group_by_show=true` | Get organized by show | `limit`, `offset` |
| `/api/feed-sources?type=podcasts` | Get show sources & API codes | None |

**API Code Formula:** `UPPERCASE(REMOVE_NON_ALPHANUMERIC(show_name))`

## Troubleshooting

### If you get 0 results for a specific show:

1. **First, check what shows are available:**
   ```http
   GET /api/podcasts?debug_shows=true
   ```

2. **Find the exact show name in the response and generate the API code:**
   - Example: `"Vital MX"` → Remove spaces/special chars → `"VitalMX"` → Uppercase → `"VITALMX"`

3. **Test the generated code:**
   ```http
   GET /api/podcasts?group_by_show=VITALMX
   ```

4. **If still getting 0 results, use the legacy parameter with exact show name:**
   ```http
   GET /api/podcasts?podcast_name=Vital MX
   ```
   
   **Note:** URL encode spaces as `%20`:
   ```http
   GET /api/podcasts?podcast_name=Vital%20MX
   ```

### Common Issues:
- **Spaces in show names:** `"Vital MX"` needs to become `"VITALMX"` 
- **Special characters:** `"The PulpMX.com Show"` becomes `"THEPULPMXCOMSHOW"`
- **Case sensitivity:** Always use UPPERCASE for API codes

## Alternative Method: Direct Show Name Access

### Why `podcast_name` Parameter Works

The `podcast_name` parameter is a **legacy/direct access method** that bypasses the API code mapping entirely. It performs a direct database lookup using the exact show name stored in the `podcasts` table.

**Code Logic:**
```javascript
// Line 82-84 in api/podcasts.js
if (podcast_name) {
  // Legacy support - direct database match
  query = query.eq('podcast_name', podcast_name);
}
```

This method:
- ✅ **Always works** if you have the exact show name
- ✅ **No API code generation** required
- ✅ **Case and character sensitive** - must match database exactly
- ✅ **Bypasses mapping logic** that might fail

### How to Use Direct Show Names

**Step 1: Get all available show names**
```http
GET /api/podcasts?debug_shows=true
```

**Step 2: Use exact names with URL encoding**
```http
GET /api/podcasts?podcast_name={EXACT_SHOW_NAME}
```

### Show Name Directory

Based on your database, here are the exact show names and their direct access URLs:

| Show Name | Direct Access URL |
|-----------|-------------------|
| `Vital MX` | `/api/podcasts?podcast_name=Vital%20MX` |
| `The Steve Matthes Show on RacerX` | `/api/podcasts?podcast_name=The%20Steve%20Matthes%20Show%20on%20RacerX` |
| `The Fly Racing Moto:60 Show` | `/api/podcasts?podcast_name=The%20Fly%20Racing%20Moto%3A60%20Show` |
| `Swapmoto Live Podcast` | `/api/podcasts?podcast_name=Swapmoto%20Live%20Podcast` |
| `The AC & JB Show` | `/api/podcasts?podcast_name=The%20AC%20%26%20JB%20Show` |
| `The PulpMX.com Show` | `/api/podcasts?podcast_name=The%20PulpMX.com%20Show` |
| `Gypsy Tales` | `/api/podcasts?podcast_name=Gypsy%20Tales` |
| `Industry Seating` | `/api/podcasts?podcast_name=Industry%20Seating` |

### URL Encoding Reference

| Character | URL Encoded |
|-----------|-------------|
| Space ` ` | `%20` |
| Colon `:` | `%3A` |
| Ampersand `&` | `%26` |
| Period `.` | `.` (no encoding needed) |

### When to Use Each Method

**Use API Codes (`group_by_show`):**
- ✅ Clean, predictable URLs
- ✅ Better for programmatic access
- ✅ Consistent naming convention
- ❌ May fail if mapping logic has issues

**Use Direct Names (`podcast_name`):**
- ✅ Always works (100% reliable)
- ✅ Direct database access
- ❌ Requires URL encoding
- ❌ Less predictable URLs

### Generating Direct Access URLs Programmatically

```javascript
// JavaScript example
function createDirectPodcastURL(showName) {
  const encodedName = encodeURIComponent(showName);
  return `https://rss-feed-podcasts.vercel.app/api/podcasts?podcast_name=${encodedName}`;
}

// Usage
const vitalMXUrl = createDirectPodcastURL("Vital MX");
// Returns: /api/podcasts?podcast_name=Vital%20MX
```
