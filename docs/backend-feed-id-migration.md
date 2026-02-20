# Backend Change: Cron Now Matches by `feed_id`

**Date:** Feb 19, 2026
**Affects:** Push notification delivery for all feed types
**Backend status:** Deployed (backward compatible — no app changes required immediately)

---

## What Changed

The cron job (`/api/cron`) that sends push notifications now matches subscribers by **`feed_id`** (stable database ID) instead of **`feed_name`** (human-readable string).

If no match is found by `feed_id`, it falls back to `feed_name` so nothing breaks for existing users.

### Why

Matching by `feed_name` was fragile:

- If a feed name changes slightly ("PulpMX Show" → "The PulpMX Show"), the match breaks silently
- The `display_name` in `youtube_channels` can differ from `channel_title` stored on individual videos, causing YouTube notifications to miss subscribers
- The old `feedId` on content items was set to the **episode/article/video ID** — completely wrong for subscriber matching

---

## What the App Needs to Send

When calling `/api/notifications/register`, the `feedId` in each preference object must be the **database primary key** from the source feed table (as a string). This is already what `/api/feed-sources` returns as `id`.

### Expected `feedId` values by type

| Feed Type | Source Table | `feedId` should be | Example |
|-----------|-------------|-------------------|---------|
| `podcasts` | `rss_feeds` | `rss_feeds.id.toString()` | `"3"` |
| `news` | `motocross_feeds` | `motocross_feeds.id.toString()` | `"7"` |
| `youtube` | `youtube_channels` | `youtube_channels.id.toString()` | `"12"` |

### How to verify

The `/api/feed-sources` endpoint returns these IDs. For example:

```json
GET /api/feed-sources

{
  "news": [
    { "id": "7", "name": "Racer X", "type": "news" },
    ...
  ],
  "podcasts": [
    { "id": "3", "name": "PulpMX Show", "type": "podcasts" },
    ...
  ],
  "youtube": [
    { "id": "12", "name": "Swap Moto Live", "type": "youtube" },
    ...
  ]
}
```

The `id` field here is exactly what `feedId` should be set to in notification preferences.

---

## What to Check in the App

### 1. Confirm `feedId` source

When the app builds a notification preference (toggling a bell, onboarding, re-registration), verify that `feedId` is set to the source feed's `id` from `/api/feed-sources` — **not** a content item ID, not a YouTube channel ID like `UCxxxxxxx`, and not an internally generated value.

### 2. Confirm the register payload looks right

A correct call to `/api/notifications/register` should look like:

```json
{
  "userId": "user_abc123",
  "expoPushToken": "ExponentPushToken[xxxxxx]",
  "preferences": [
    { "feedId": "7",  "feedName": "Racer X",       "feedType": "news" },
    { "feedId": "3",  "feedName": "PulpMX Show",    "feedType": "podcasts" },
    { "feedId": "12", "feedName": "Swap Moto Live",  "feedType": "youtube" }
  ]
}
```

### 3. Check the persisted name map

The v1.4.4 fix added `notification_feed_name_map` in AsyncStorage. Confirm that the same data source used to populate that map also provides the correct `feedId` (from `/api/feed-sources`).

---

## Backward Compatibility

| Scenario | What happens |
|----------|-------------|
| App sends correct `feedId` + correct `feedName` | Matches by `feed_id` (primary) |
| App sends correct `feedId` + wrong `feedName` | Still matches by `feed_id` |
| App sends wrong `feedId` + correct `feedName` | Falls back to `feed_name` match |
| App sends wrong `feedId` + wrong `feedName` | No match — user won't get notifications |
| App sends no `feedId` (null/undefined) | Falls back to `feed_name` match |

The fallback means **nothing will break** with the current app versions. But getting `feedId` right means notifications will survive future feed name changes.

---

## Vercel Log Changes

The cron logs now show which matching method was used:

```
[PUSH] Found 5 subscribers for Racer X (matched by feed_id)
[PUSH] Found 3 subscribers for PulpMX Show (matched by feed_name)
[PUSH] No subscribers for Swap Moto Live (feedId: 12)
```

- `matched by feed_id` — the app sent the correct database ID
- `matched by feed_name` — fell back to name matching (legacy row or incorrect `feedId`)
- The `feedId` value is shown on misses so you can cross-reference with the `notification_preferences` table

---

## Supabase Queries for Validation

After the next app release, verify preferences are being stored with correct `feed_id` values:

```sql
-- Check what feed_id values are being stored
SELECT DISTINCT feed_id, feed_name, feed_type, COUNT(*) as user_count
FROM notification_preferences
WHERE notifications_enabled = true
GROUP BY feed_id, feed_name, feed_type
ORDER BY feed_type, feed_name;
```

**Good rows:** `feed_id` is a small integer string like `"3"`, `"7"`, `"12"`

**Bad rows:** `feed_id` is a content item ID (large number), a YouTube channel ID (`UCxxxxxxx`), null, or a placeholder
