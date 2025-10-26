# 📰 News API Endpoints Documentation

## Base URL
```
https://rss-feed-podcasts.vercel.app/api
```

## How the System Works

### Two-Table Architecture

The news system uses **two separate tables** that work together:

#### 1. **`motocross_feeds` Table** - Feed Configuration
- **Purpose:** Stores RSS feed sources and configuration
- **Contains:** Feed URLs, company names, feed names, active status
- **Function:** Defines what news sources are available to fetch
- **Access via:** `/api/news/sources`

#### 2. **`articles` Table** - Article Storage  
- **Purpose:** Stores actual news articles and metadata
- **Contains:** Article titles, excerpts, URLs, publish dates, images
- **Function:** Holds the fetched article data from RSS feeds
- **Access via:** `/api/articles` (all endpoints below)

### Data Flow
```
RSS Feeds → Cron Job → `motocross_feeds` table → Fetch Articles → `articles` table → API Endpoints
```

1. **Configure feeds** in `motocross_feeds` table
2. **Cron job runs** every 15 minutes (`/api/cron`)
3. **Articles fetched** from active RSS feeds
4. **Articles stored** in `articles` table  
5. **API serves articles** from `articles` table

### Performance Optimizations
- **Fast Discovery:** `/api/news/sources` uses optimized 2-query approach
- **Response Time:** ~200-500ms (vs 2-5 seconds previously)
- **Efficient Queries:** Bulk operations instead of N+1 query pattern

## Core News Endpoints

### 1. **Get All Articles** 
```http
GET /api/articles
```

**Default Behavior:**
- Returns latest 20 articles across all sources
- Sorted by publish date (newest first)
- Flat list format

**Basic Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "2025 Supercross Season Preview",
      "excerpt": "Everything you need to know about the upcoming season...",
      "content": "Full article content...",
      "url": "https://vitalmx.com/article/...",
      "published_date": "2025-01-15T10:00:00Z",
      "image_url": "https://vitalmx.com/images/...",
      "company": "Vital MX",
      "author": "John Smith"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "count": 20
  },
  "grouped_by_source": false
}
```

---

### 2. **Discover Available Sources** ⚡ **FAST**
```http
GET /api/news/sources
```

**Purpose:** Get all available news sources with metadata for app consumption

**Performance:** ~200-500ms response time with optimized queries

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "source_name": "Vital MX",
      "feed_name": "Vital MX RSS Feed",
      "article_count": 250,
      "latest_article_date": "2025-09-21T08:00:00Z",
      "source_image": "https://vitalmx.com/images/article123.jpg",
      "endpoint_url": "/api/articles?group_by_source=VITALMX",
      "description": "Articles from Vital MX",
      "has_articles": true
    },
    {
      "source_name": "Racer X",
      "feed_name": "Racer X Online",
      "article_count": 0,
      "latest_article_date": null,
      "source_image": null,
      "endpoint_url": "/api/articles?group_by_source=RACERX",
      "description": "Articles from Racer X",
      "has_articles": false
    }
  ],
  "total_sources": 10
}
```

**Shows all configured sources:**
- ✅ **Sources with articles** (sorted by latest article date)
- ✅ **Sources without articles** (article_count: 0, has_articles: false)
- ✅ **Ready-to-use URLs** for all sources
- ⚡ **Optimized Performance:** 2-query bulk approach

---

### 3. **Get Articles by Specific Source**
```http
GET /api/articles?group_by_source={API_CODE}
```

**API Code Generation:** Take the company name, uppercase it, remove all non-alphanumeric characters
- `"Vital MX"` → `VITALMX`
- `"Racer X"` → `RACERX`
- `"Motocross Action"` → `MOTOCROSSACTION`

**Example:**
```http
GET /api/articles?group_by_source=VITALMX
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "title": "Latest News Article",
      "excerpt": "Article summary...",
      "company": "Vital MX",
      // ... other article fields
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "count": 15 },
  "grouped_by_source": true
}
```

---

## Query Parameters

### **Pagination**
```http
GET /api/articles?limit=10&offset=20
```
- `limit`: Number of articles to return (default: 20)
- `offset`: Number of articles to skip (default: 0)

### **Search**
```http
GET /api/articles?search=supercross
```
- Searches in article titles and excerpts
- Case insensitive

### **Direct Company Filter**
```http
GET /api/articles?company=Vital MX
```
- Direct company name filter (legacy support)
- Must match exact company name in database

### **Multi-Source Filter** ⭐ NEW
```http
GET /api/articles?sources=VITALMX,RACERX,MXVICE&limit=20
```
- **Single API call** to fetch from multiple sources
- `sources`: Comma-separated list of API codes
- Get API codes from `/api/news/sources` (includes `api_code` field)
- Server-side filtering, sorting, and combining
- **Recommended for user-selected feeds**

**Example:**
```javascript
// Get sources user selected
const apiCodes = ['VITALMX', 'RACERX', 'MXVICE'];
const url = `/api/articles?sources=${apiCodes.join(',')}&limit=20`;
// Single call returns filtered, sorted articles from all 3 sources
```

See [MULTI_SOURCE_API.md](MULTI_SOURCE_API.md) for complete guide.

### **Combined Parameters**
```http
GET /api/articles?group_by_source=VITALMX&limit=5&search=highlights
```

---

## Discovery Endpoints

### **Get Available News Sources**
```http
GET /api/feed-sources?type=news
```

**Purpose:** Get all configured news sources with API codes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Vital MX",
      "apiCode": "VITALMX",
      "logo": "https://via.placeholder.com/100x100/FF5722/FFFFFF?text=V",
      "category": "Motocross News",
      "enabled": false,
      "type": "news",
      "priority": 1
    }
  ],
  "type": "news"
}
```

---

## Common Use Cases

### **1. App Discovery Flow (Recommended)**
```http
# Step 1: Discover available sources
GET /api/news/sources

# Step 2: Use endpoint_url from response  
GET /api/articles?group_by_source=VITALMX
```

### **2. Get Latest Articles Across All Sources**
```http
GET /api/articles?limit=10
```

### **3. Get All Articles from One Source**
```http
GET /api/articles?group_by_source=VITALMX
```

### **4. Search Specific Source**
```http
GET /api/articles?group_by_source=VITALMX&search=supercross
```

### **5. Search All Articles**
```http
GET /api/articles?search=ken+roczen
```

### **6. Paginate Through Articles**
```http
GET /api/articles?limit=10&offset=0    # First page
GET /api/articles?limit=10&offset=10   # Second page
GET /api/articles?limit=10&offset=20   # Third page
```

---

## Response Format Notes

**Article Fields:**
- `id`: Unique article identifier
- `title`: Article headline
- `excerpt`: Article summary/excerpt
- `content`: Full article content
- `url`: Original article URL
- `published_date`: Publication date (ISO 8601)
- `image_url`: Article featured image URL
- `company`: News source/company name
- `author`: Article author

**Pagination:**
- Always includes `pagination` object with current `limit`, `offset`, and actual `count` returned
- `count` may be less than `limit` if fewer articles are available

**Grouping:**
- `grouped_by_source`: Boolean indicating if results are filtered by source

**Error Handling:**
- HTTP 200: Success
- HTTP 400: Bad request (invalid parameters)
- HTTP 500: Server error
- All errors include `{ "success": false, "error": "message" }`

---

## Quick Reference

| Endpoint | Purpose | Key Parameters |
|----------|---------|----------------|
| `/api/articles` | Get all articles | `limit`, `offset`, `search` |
| `/api/news/sources` | List available sources | None |
| `/api/articles?group_by_source={CODE}` | Get specific source articles | API code from company name |
| `/api/feed-sources?type=news` | Get source info & API codes | None |

**API Code Formula:** `UPPERCASE(REMOVE_NON_ALPHANUMERIC(company_name))`

## Performance Notes

### Optimized Discovery Endpoint

The `/api/news/sources` endpoint has been optimized for speed:

**Before (Slow):**
- N+1 query problem: 1 query for sources + N queries for each source's article count
- Could take 2-5 seconds with many sources

**After (Fast):**
- 2-query approach: 1 query for sources + 1 bulk query for all articles
- Consistent ~200-500ms response time
- Processes data in-memory for counts and latest article info

**Technical Implementation:**
```javascript
// Query 1: Get all active sources
const sources = await supabase
  .from('motocross_feeds')
  .select('company_name, feed_name')
  .eq('is_active', true);

// Query 2: Get all articles for these sources (bulk)
const articles = await supabase
  .from('articles')
  .select('company, published_date, image_url')
  .in('company', sources.map(s => s.company_name));

// Process in-memory for stats
```

## Troubleshooting

### If you get 0 results for a specific source:

1. **First, check what sources are available:**
   ```http
   GET /api/news/sources
   ```

2. **Find the exact company name in the response and generate the API code:**
   - Example: `"Vital MX"` → Remove spaces/special chars → `"VitalMX"` → Uppercase → `"VITALMX"`

3. **Test the generated code:**
   ```http
   GET /api/articles?group_by_source=VITALMX
   ```

4. **If still getting 0 results, use the legacy parameter with exact company name:**
   ```http
   GET /api/articles?company=Vital MX
   ```

### Common Issues:
- **Spaces in company names:** `"Vital MX"` needs to become `"VITALMX"` 
- **Special characters:** `"Motocross Action"` becomes `"MOTOCROSSACTION"`
- **Case sensitivity:** Always use UPPERCASE for API codes

## Alternative Method: Direct Company Name Access

### Why `company` Parameter Works

The `company` parameter is a **legacy/direct access method** that bypasses the API code mapping entirely. It performs a direct database lookup using the exact company name stored in the `articles` table.

**Code Logic:**
```javascript
// Direct database match
if (company) {
  query = query.eq('company', company);
}
```

This method:
- ✅ **Always works** if you have the exact company name
- ✅ **No API code generation** required
- ✅ **Case and character sensitive** - must match database exactly
- ✅ **Bypasses mapping logic** that might fail

### How to Use Direct Company Names

**Step 1: Get all available company names**
```http
GET /api/news/sources
```

**Step 2: Use exact names**
```http
GET /api/articles?company={EXACT_COMPANY_NAME}
```

### Company Name Directory

Based on your database, here are the exact company names and their direct access URLs:

| Company Name | Direct Access URL |
|--------------|-------------------|
| `Vital MX` | `/api/articles?company=Vital%20MX` |
| `Racer X` | `/api/articles?company=Racer%20X` |
| `Motocross Action` | `/api/articles?company=Motocross%20Action` |

### When to Use Each Method

**Use API Codes (`group_by_source`):**
- ✅ Clean, predictable URLs
- ✅ Better for programmatic access
- ✅ Consistent naming convention

**Use Direct Names (`company`):**
- ✅ Always works (100% reliable)
- ✅ Direct database access
- ❌ Requires URL encoding
- ❌ Less predictable URLs
