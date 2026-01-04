# Race Schedule API Documentation

API for the "Live" tab feature - displays race schedule and powers race day notifications.

## Endpoint

```
GET /api/race-schedule
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `series` | string | No | Filter by series: `supercross`, `motocross`, or `smx` |

### Response

```json
{
  "success": true,
  "data": {
    "currentEvent": { ... } | null,
    "nextEvent": { ... } | null,
    "timeUntilNext": {
      "milliseconds": 86400000,
      "hours": 24,
      "days": 1,
      "formatted": "1 day"
    } | null,
    "isAnyEventLive": true | false,
    "allEvents": [ ... ],
    "bySeries": {
      "supercross": [ ... ],
      "motocross": [ ... ],
      "smx": [ ... ]
    },
    "totalEvents": 31
  },
  "timestamp": "2026-01-10T18:00:00.000Z"
}
```

### Event Object

```json
{
  "id": 1,
  "round": 1,
  "series": "supercross",
  "venue": "Angel Stadium",
  "city": "Anaheim",
  "state": "CA",
  "coverageStartUTC": "2026-01-10T18:00:00Z",
  "gateDropUTC": "2026-01-11T00:00:00Z",
  "timezone": "America/Los_Angeles",
  "isTBD": false,
  "isLive": true,
  "isCoverageActive": true,
  "isMainsActive": false,
  "liveWindowStart": "2026-01-10T18:00:00Z",
  "liveWindowEnd": "2026-01-11T04:00:00Z"
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `coverageStartUTC` | When live timing begins (10 AM local - practice/qualifying) |
| `gateDropUTC` | When main events start |
| `isLive` | `true` if current time is within the live window |
| `isCoverageActive` | `true` if practice/qualifying is happening (before mains) |
| `isMainsActive` | `true` if main events are happening (gate drop and after) |
| `liveWindowStart` | Same as `coverageStartUTC` |
| `liveWindowEnd` | 4 hours after `gateDropUTC` |

---

## Frontend Implementation Guide

### 1. Show/Hide "Live" Tab

```typescript
// Check if any race is currently live
const response = await fetch('/api/race-schedule');
const { data } = await response.json();

// Show Live tab if any event is live
const showLiveTab = data.isAnyEventLive;

// Or check for a specific current event
if (data.currentEvent) {
  // Show the Live tab with this event
  console.log(`${data.currentEvent.series} Round ${data.currentEvent.round} is LIVE`);
}
```

### 2. Display Current/Next Event

```typescript
if (data.currentEvent) {
  // Race is happening NOW
  const event = data.currentEvent;
  
  if (event.isCoverageActive) {
    // Practice/Qualifying in progress
    console.log('Practice & Qualifying');
  } else if (event.isMainsActive) {
    // Main events happening
    console.log('Main Events');
  }
} else if (data.nextEvent) {
  // Show countdown to next race
  console.log(`Next: Round ${data.nextEvent.round} in ${data.timeUntilNext.formatted}`);
}
```

### 3. Embed Live Timing WebView

When `isLive === true`, embed the live timing page:

```typescript
const LIVE_TIMING_URL = 'https://www.supermotocross.com/results/';

// In your WebView component
<WebView 
  source={{ uri: LIVE_TIMING_URL }}
  style={{ flex: 1 }}
/>
```

### 4. Polling for Live Status

Poll the API to detect when races go live:

```typescript
useEffect(() => {
  const checkLiveStatus = async () => {
    const response = await fetch('/api/race-schedule');
    const { data } = await response.json();
    setIsLive(data.isAnyEventLive);
    setCurrentEvent(data.currentEvent);
  };

  // Check immediately
  checkLiveStatus();

  // Poll every 60 seconds
  const interval = setInterval(checkLiveStatus, 60000);
  
  return () => clearInterval(interval);
}, []);
```

---

## Push Notifications

Users receive **two notifications per race** (sent to all users with push enabled):

### 1. Coverage Start (10 AM local)

```
Title: "Supercross Round 1"
Body: "Live timing is starting - Angel Stadium"
Subtitle (iOS only): "Anaheim, CA"
```

**Notification Data:**
```json
{
  "type": "race_coverage_start",
  "eventId": 1,
  "round": 1,
  "series": "supercross",
  "venue": "Angel Stadium",
  "coverageStartUTC": "2026-01-10T18:00:00Z",
  "gateDropUTC": "2026-01-11T00:00:00Z"
}
```

### 2. Main Events (10 minutes before gate drop)

```
Title: "Supercross Round 1"
Body: "Main events starting soon - Angel Stadium"
Subtitle (iOS only): "Anaheim, CA"
```

**Notification Data:**
```json
{
  "type": "race_mains_start",
  "eventId": 1,
  "round": 1,
  "series": "supercross",
  "venue": "Angel Stadium",
  "gateDropUTC": "2026-01-11T00:00:00Z"
}
```

### Handling Notification Tap

```typescript
// When user taps a race notification
const handleNotification = (notification) => {
  const { type } = notification.data;
  
  if (type === 'race_coverage_start' || type === 'race_mains_start') {
    // Navigate to Live tab
    navigation.navigate('Live');
  }
};
```

### Android Notification Channel

Register the `race_alerts` channel for race notifications:

```typescript
await Notifications.setNotificationChannelAsync('race_alerts', {
  name: 'Race Alerts',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
});
```

---

## 2026 Schedule Overview

| Series | Rounds | Dates |
|--------|--------|-------|
| Supercross | 1-17 | Jan 10 - May 9 |
| Pro Motocross | 18-28 | May 30 - Aug 29 |
| SMX Playoffs | 29-31 | Sep 12 - Sep 26 (TBD) |

---

## Examples

### Get Full Schedule

```bash
curl https://your-api.vercel.app/api/race-schedule
```

### Get Only Supercross Events

```bash
curl https://your-api.vercel.app/api/race-schedule?series=supercross
```

### Check if Race is Live

```typescript
const { data } = await fetch('/api/race-schedule').then(r => r.json());

if (data.isAnyEventLive) {
  // Show Live tab
  showLiveTab(data.currentEvent);
}
```

