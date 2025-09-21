# 🎬 Manual Video Pull API Documentation

## Overview

The Manual Video Pull API allows you to trigger video fetching from a specific YouTube channel for a specified number of days. This is useful for:

- Backfilling videos from a channel
- Testing video fetching for a specific channel
- Manual synchronization when automatic cron jobs aren't sufficient

## Endpoint

```http
POST /api/trigger-video-pull
```

## Request Format

**Content-Type:** `application/json`

**Body Parameters:**
- `channel_id` (required): The YouTube channel ID to fetch videos from
- `days` (optional): Number of days back to fetch videos (default: 7, max: 365)

## Example Request

```bash
curl -X POST https://rss-feed-podcasts.vercel.app/api/trigger-video-pull \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "UCxxxxxxxxxxxxxxxxxxxxx",
    "days": 30
  }'
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Manual video pull completed for Channel Name",
  "data": {
    "channel_id": "UCxxxxxxxxxxxxxxxxxxxxx",
    "channel_name": "Channel Name", 
    "days_requested": 30,
    "videos_found": 15,
    "duration_seconds": 2.5,
    "playlist_id": "UUxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Channel UCxxxxxxxxxxxxxxxxxxxxx not found or not active"
}
```

## How It Works

1. **Validates Input:** Checks channel_id and days parameters
2. **Finds Channel:** Looks up the channel in the `youtube_channels` table
3. **Fetches Videos:** Calls YouTube API to get videos from the last X days
4. **Processes Videos:** Gets detailed video information and filters embeddable videos
5. **Stores Results:** Saves new videos to `youtube_videos` table
6. **Updates Channel:** Updates the channel's `last_video_id` and `last_fetched` timestamp

## Requirements

- Channel must exist in the `youtube_channels` table
- Channel must be marked as `is_active = true`
- Channel must have a valid `uploads_playlist_id`
- YouTube API key must be configured

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `channel_id is required` | Missing channel_id in request body |
| 400 | `days must be a number between 1 and 365` | Invalid days parameter |
| 400 | `Channel has no uploads playlist ID configured` | Channel missing playlist ID |
| 404 | `Channel not found or not active` | Channel doesn't exist or is inactive |
| 500 | `YouTube API key not configured` | Missing YOUTUBE_API_KEY environment variable |
| 500 | `Failed to fetch videos: [error]` | YouTube API or processing error |

## Usage Examples

### Fetch Last 7 Days (Default)
```bash
curl -X POST https://rss-feed-podcasts.vercel.app/api/trigger-video-pull \
  -H "Content-Type: application/json" \
  -d '{"channel_id": "UCxxxxxxxxxxxxxxxxxxxxx"}'
```

### Fetch Last 30 Days
```bash
curl -X POST https://rss-feed-podcasts.vercel.app/api/trigger-video-pull \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "UCxxxxxxxxxxxxxxxxxxxxx",
    "days": 30
  }'
```

### Get Channel ID from `/api/videos/channels`
First, get available channels:
```bash
curl https://rss-feed-podcasts.vercel.app/api/videos/channels
```

Then use the `channel_id` from the response in your trigger request.

## Performance Notes

- Fetching is limited to 200 videos per request (safety limit)
- Videos are processed in batches of 50 (YouTube API limit)
- Only embeddable videos are stored
- Duplicate videos are handled via upsert (no duplicates created)

## Integration with Existing System

This endpoint integrates seamlessly with your existing video system:

- Uses the same `youtube_channels` and `youtube_videos` tables
- Follows the same data structure as the cron job
- Updates channel metadata (last_video_id, last_fetched)
- Respects the same filtering rules (embeddable only)

## Security Considerations

- No authentication required (same as other endpoints)
- Rate limited by YouTube API quotas
- Input validation prevents excessive day ranges
- Channel access restricted to active channels in database
