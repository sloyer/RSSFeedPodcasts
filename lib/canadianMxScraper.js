// lib/canadianMxScraper.js
// Shared utilities for Triple Crown Series (Canadian MX Nationals) endpoints.
// Data source: https://triplecrownseries.ca/results
//
// How it works:
//   1. Scrape the /results page HTML to extract the current EVENT_ID and
//      per-class race IDs (these are hardcoded in an inline <script> tag).
//   2. Fetch https://triplecrownseries.ca/data/livelaps/{EVENT_ID}/race-{ID}-state.json
//      for live/finished race results (updates every ~10s during live sessions).
//   3. Fetch https://triplecrownseries.ca/data/riders.json for team/rider roster
//      and 2025 championship standings.

export const BASE_URL = 'https://triplecrownseries.ca';

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------
const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { cache.delete(key); return null; }
  return entry.data;
}

export function setCache(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------------------------------------------------------------------------
// Scrape the results page to get current event config
// Returns: { eventId, classes, moto1Id, moto2Id, allRaceIds }
// ---------------------------------------------------------------------------
export async function scrapeEventConfig() {
  const cached = getCached('event_config');
  if (cached) return cached;

  const html = await fetch(`${BASE_URL}/results`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MotoApp/1.0)' }
  }).then(r => r.text());

  // Extract the inline script block that contains EVENT_ID, CLASSES, etc.
  const scriptMatch = html.match(/var EVENT_ID='(\d+)',\s*BASE='([^']+)'[\s\S]*?var CLASSES=(\[[\s\S]*?\]);[\s\S]*?var MOTO1='(\d+)',\s*MOTO2='(\d+)'/);

  if (!scriptMatch) {
    throw new Error('Could not parse event config from Triple Crown results page');
  }

  const eventId = scriptMatch[1];
  const classesRaw = scriptMatch[3];
  const moto1Id = scriptMatch[4];
  const moto2Id = scriptMatch[5];

  // Parse CLASSES array — extract key, label, cn, q (qualifying race ID), accent
  const classes = [];
  const classRe = /\{key:'([^']+)',\s*label:'([^']+)',\s*cn:'([^']+)',\s*q:'(\d+)',\s*accent:'([^']+)'\}/g;
  let m;
  while ((m = classRe.exec(classesRaw)) !== null) {
    classes.push({
      key: m[1],       // e.g. '450'
      label: m[2],     // e.g. '450 Pro'
      className: m[3], // e.g. '450 Pro'
      qualifyingId: m[4],
      accent: m[5]
    });
  }

  const allRaceIds = [...classes.map(c => c.qualifyingId), moto1Id, moto2Id];

  const config = { eventId, classes, moto1Id, moto2Id, allRaceIds };

  // Cache for 5 minutes — event IDs only change between rounds
  setCache('event_config', config, 5 * 60 * 1000);
  return config;
}

// ---------------------------------------------------------------------------
// Fetch a single race state JSON
// Returns null if not yet published (404)
// ---------------------------------------------------------------------------
export async function fetchRaceState(eventId, raceId) {
  const url = `${BASE_URL}/data/livelaps/${eventId}/race-${raceId}-state.json?cb=${Date.now()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MotoApp/1.0)' }
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Format lap time from milliseconds -> "m:ss.mmm"
// ---------------------------------------------------------------------------
export function formatLapTime(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
}

// ---------------------------------------------------------------------------
// Format gap from milliseconds -> "+m:ss.mmm" or "+s.mmm"
// ---------------------------------------------------------------------------
export function formatGap(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `+${totalSec.toFixed(3)}`;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(3).padStart(6, '0');
  return `+${mins}:${secs}`;
}

// ---------------------------------------------------------------------------
// Normalize a race state result row to a clean object
// ---------------------------------------------------------------------------
export function normalizeResult(r) {
  return {
    position: r.pos,
    overall: r.overall,
    number: r.num,
    name: r.name,
    class: r.className,
    brand: r.brand || null,
    country: r.country || null,
    laps: r.laps,
    bestLap: formatLapTime(r.bestLap),
    bestLapMs: r.bestLap,
    lastLap: formatLapTime(r.lastLap),
    totalTime: formatLapTime(r.totalTime),
    gap: formatGap(r.gap),
    status: r.status || null,
    lapsDetail: (r.lapsArr || []).map(l => ({
      lap: l.n,
      time: formatLapTime(l.t),
      timeMs: l.t,
      best: l.b,
      posOverall: l.pO,
      posClass: l.pC
    }))
  };
}
