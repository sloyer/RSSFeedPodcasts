# 📹 Videos API Endpoints Documentation

## Base URL
```
https://rss-feed-podcasts.vercel.app/api
```

## How the System Works

### Two-Table Architecture

The videos system uses **two separate tables** that work together:

#### 1. **`youtube_channels` Table** - Channel Configuration
- **Purpose:** Stores YouTube channel sources and configuration
- **Contains:** Channel IDs, channel names, display names, active status
- **Function:** Defines what video channels are available to fetch
- **Access via:** `/api/videos/channels`

#### 2. **`youtube_videos` Table** - Video Storage  
- **Purpose:** Stores actual YouTube videos and metadata
- **Contains:** Video titles, descriptions, video URLs, publish dates, thumbnails
- **Function:** Holds the fetched video data from YouTube channels
- **Access via:** `/api/youtube` (all endpoints below)

### Data Flow
```
YouTube Channels → Cron Job → `youtube_channels` table → Fetch Videos → `youtube_videos` table → API Endpoints
```

1. **Configure channels** in `youtube_channels` table
2. **Cron job runs** every 15 minutes (`/api/cron`)
3. **Videos fetched** from active YouTube channels
4. **Videos stored** in `youtube_videos` table  
5. **API serves videos** from `youtube_videos` table

## Core Video Endpoints

### 1. **Get All Videos** 
```http
GET /api/youtube
```

**Default Behavior:**
- Returns latest 20 videos across all channels
- Sorted by publish date (newest first)
- Flat list format
- Only embeddable videos

**Basic Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123xyz",
      "channelId": "UCxxxxx",
      "channelName": "Vital MX",
      "title": "2025 Supercross Round 1 Highlights",
      "description": "Best moments from opening round...",
      "publishedAt": "2025-01-15T10:00:00Z",
      "thumbnailUrl": "https://img.youtube.com/vi/abc123xyz/maxresdefault.jpg",
      "duration": "PT10M30S",
      "embedUrl": "https://www.youtube.com/embed/abc123xyz",
      "watchUrl": "https://www.youtube.com/watch?v=abc123xyz",
      "embedHtml": "<iframe...>"
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

### 2. **Discover Available Channels**
```http
GET /api/videos/channels
```

**Purpose:** Get all available video channels with metadata for app consumption

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "channel_name": "Vital MX",
      "channel_id": "UCxxxxx",
      "video_count": 150,
      "latest_video_date": "2025-09-21T08:00:00Z",
      "channel_image": "https://img.youtube.com/vi/latest/maxresdefault.jpg",
      "endpoint_url": "/api/youtube?channel_id=VITALMX",
      "description": "Videos from Vital MX",
      "has_videos": true
    },
    {
      "channel_name": "Supercross Live",
      "channel_id": "UCyyyyy",
      "video_count": 0,
      "latest_video_date": null,
      "channel_image": null,
      "endpoint_url": "/api/youtube?channel_id=SUPERCROSSLIVE",
      "description": "Videos from Supercross Live",
      "has_videos": false
    }
  ],
  "total_channels": 8
}
```

**Shows all configured channels:**
- ✅ **Channels with videos** (sorted by latest video date)
- ✅ **Channels without videos** (video_count: 0, has_videos: false)
- ✅ **Ready-to-use URLs** for all channels

---

### 3. **Get Videos by Specific Channel**
```http
GET /api/youtube?channel_id={API_CODE}
```

**API Code Generation:** Take the channel name, uppercase it, remove all non-alphanumeric characters
- `"Vital MX"` → `VITALMX`
- `"Supercross Live"` → `SUPERCROSSLIVE`
- `"Rocky Mountain ATV/MC"` → `ROCKYMOUNTAINATVMC`

**Example:**
```http
GET /api/youtube?channel_id=VITALMX
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123xyz",
      "channelId": "UCxxxxx",
      "channelName": "Vital MX",
      "title": "Latest Video Title",
      // ... other video fields
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "count": 12 }
}
```

---

## Query Parameters

### **Pagination**
```http
GET /api/youtube?limit=10&offset=20
```
- `limit`: Number of videos to return (default: 20)
- `offset`: Number of videos to skip (default: 0)

### **Search**
```http
GET /api/youtube?search=supercross
```
- Searches in video titles and descriptions
- Case insensitive

### **Date Range**
```http
GET /api/youtube?days=30
```
- `days`: Number of days back to fetch videos (default: 7)

### **Multiple Channels**
```http
GET /api/youtube?channels=UCxxxxx,UCyyyyy
```
- `channels`: Comma-separated channel IDs for user preferences

### **Combined Parameters**
```http
GET /api/youtube?channel_id=VITALMX&limit=5&search=highlights&days=14
```

---

## Discovery Endpoints

### **Get Available Channel Sources**
```http
GET /api/feed-sources?type=youtube
```

**Purpose:** Get all configured video channels with API codes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Vital MX",
      "apiCode": "VITALMX",
      "logo": "https://via.placeholder.com/100x100/F44336/FFFFFF?text=V",
      "category": "YouTube",
      "enabled": false,
      "type": "youtube",
      "priority": 1
    }
  ],
  "type": "youtube"
}
```

---

## Common Use Cases

### **1. App Discovery Flow (Recommended)**
```http
# Step 1: Discover available channels
GET /api/videos/channels

# Step 2: Use endpoint_url from response  
GET /api/youtube?channel_id=VITALMX
```

### **2. Get Latest Videos Across All Channels**
```http
GET /api/youtube?limit=10
```

### **3. Get All Videos from One Channel**
```http
GET /api/youtube?channel_id=VITALMX
```

### **4. Search Specific Channel**
```http
GET /api/youtube?channel_id=VITALMX&search=supercross
```

### **5. Get Recent Videos (Last 30 Days)**
```http
GET /api/youtube?days=30&limit=50
```

### **6. Paginate Through Videos**
```http
GET /api/youtube?limit=10&offset=0    # First page
GET /api/youtube?limit=10&offset=10   # Second page
GET /api/youtube?limit=10&offset=20   # Third page
```

---

## Response Format Notes

**Video Fields:**
- `id`: YouTube video ID
- `channelId`: YouTube channel ID
- `channelName`: Channel display name
- `title`: Video title
- `description`: Video description
- `publishedAt`: Publication date (ISO 8601)
- `thumbnailUrl`: Video thumbnail URL
- `duration`: Video duration (ISO 8601 format)
- `embedUrl`: YouTube embed URL
- `watchUrl`: YouTube watch URL
- `embedHtml`: Ready-to-use embed HTML

**Pagination:**
- Always includes `pagination` object with current `limit`, `offset`, and actual `count` returned
- `count` may be less than `limit` if fewer videos are available

**Error Handling:**
- HTTP 200: Success
- HTTP 400: Bad request (invalid parameters)
- HTTP 500: Server error
- All errors include `{ "success": false, "error": "message" }`

---

## Quick Reference

| Endpoint | Purpose | Key Parameters |
|----------|---------|----------------|
| `/api/youtube` | Get all videos | `limit`, `offset`, `search`, `days` |
| `/api/videos/channels` | List available channels | None |
| `/api/youtube?channel_id={CODE}` | Get specific channel videos | API code from channel name |
| `/api/feed-sources?type=youtube` | Get channel sources & API codes | None |

**API Code Formula:** `UPPERCASE(REMOVE_NON_ALPHANUMERIC(channel_name))`

## Troubleshooting

### If you get 0 results for a specific channel:

1. **First, check what channels are available:**
   ```http
   GET /api/videos/channels
   ```

2. **Find the exact channel name in the response and generate the API code:**
   - Example: `"Vital MX"` → Remove spaces/special chars → `"VitalMX"` → Uppercase → `"VITALMX"`

3. **Test the generated code:**
   ```http
   GET /api/youtube?channel_id=VITALMX
   ```

### Common Issues:
- **Spaces in channel names:** `"Vital MX"` needs to become `"VITALMX"` 
- **Special characters:** `"Rocky Mountain ATV/MC"` becomes `"ROCKYMOUNTAINATVMC"`
- **Case sensitivity:** Always use UPPERCASE for API codes
- **No videos:** Check `days` parameter - default is only last 7 days
