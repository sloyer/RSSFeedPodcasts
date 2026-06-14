// api/canadian-mx/results.js
// Returns live or finished race results for a Triple Crown Series session.
//
// GET /api/canadian-mx/results?event={eventId}&race={raceId}
//   — fetch a specific race by its ID
//
// GET /api/canadian-mx/results?class=450&session=m1
//   — auto-resolve race ID from current event config
//   session: q (qualifying) | m1 (moto 1) | m2 (moto 2)
//   class:   450 | 250 | wmx
//
// Response includes:
//   - race metadata (name, status, start time)
//   - results array (position, rider, laps, best/last lap, gap)
//   - per-rider lap-by-lap breakdown
//   - TTL 30s if Live, 5 min if Finished

import {
  applyCors,
  scrapeEventConfig,
  fetchRaceState,
  normalizeResult,
  getCached,
  setCache
} from '../../lib/canadianMxScraper.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let eventId = req.query.event;
    let raceId = req.query.race;

    // Auto-resolve from class + session if no explicit IDs given
    if (!raceId) {
      const cls = (req.query.class || '450').toLowerCase();
      const session = (req.query.session || 'q').toLowerCase();

      const config = await scrapeEventConfig();
      eventId = config.eventId;

      if (session === 'm1') {
        raceId = config.moto1Id;
      } else if (session === 'm2') {
        raceId = config.moto2Id;
      } else {
        // Qualifying — class-specific
        const classConfig = config.classes.find(c => c.key === cls);
        if (!classConfig) {
          return res.status(400).json({
            error: `Unknown class "${cls}". Use: ${config.classes.map(c => c.key).join(', ')}`
          });
        }
        raceId = classConfig.qualifyingId;
      }
    }

    if (!eventId || !raceId) {
      return res.status(400).json({ error: 'Provide ?race=ID&event=ID or ?class=450&session=q' });
    }

    const cacheKey = `canadian_mx_race_${eventId}_${raceId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const state = await fetchRaceState(eventId, raceId);

    if (!state) {
      return res.status(404).json({
        error: 'Race data not yet available. Session may not have started.',
        eventId,
        raceId
      });
    }

    const isLive = state.race?.status === 'Live';
    const results = (state.results || []).map(normalizeResult);

    const response = {
      series: 'canadian_mx',
      seriesName: 'Triple Crown Series',
      eventId,
      raceId,
      race: {
        id: state.race?.id,
        name: state.race?.name,
        status: state.race?.status,       // "Live" | "Finished" | null
        startTime: state.race?.startTime,
        isLive
      },
      resultCount: results.length,
      results,
      updatedAt: new Date(state.ts * 1000).toISOString(),
      liveTimingUrl: 'https://triplecrownseries.ca/live'
    };

    const ttl = isLive ? 30 * 1000 : 5 * 60 * 1000;
    setCache(cacheKey, response, ttl);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', isLive ? 'no-store' : 'public, max-age=300');
    return res.status(200).json(response);

  } catch (err) {
    console.error('Canadian MX results error:', err);
    return res.status(500).json({ error: err.message });
  }
}
