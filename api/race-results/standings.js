// api/race-results/standings.js
// GET /api/race-results/standings?series_id=NNN&event_id=NNN&series=smx&live=true?
//
// Returns championship points/standings for the given series, with per-round
// breakdown extracted from the LiveMX series-points table.

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  parseStandings,
  liveMode,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

const TTL_RACE_DAY_MS = 2 * 60 * 1000;
const TTL_OFF_DAY_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const series = normalizeSeries(req.query.series);
  const seriesId = String(req.query.series_id || '').trim();
  const eventId = String(req.query.event_id || '').trim();

  if (!seriesId || !/^\d+$/.test(seriesId)) {
    return res.status(400).json({ error: 'series_id is required (numeric)' });
  }
  if (!eventId || !/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'event_id is required (numeric)' });
  }

  const cacheKey = `standings:${series}:${seriesId}:${eventId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const url = `${liveMxBase(series)}/results/?p=view_series_points&id=${seriesId}&event_id=${eventId}`;
    const html = await fetchHtml(url);
    const $ = loadHtml(html);

    const { title, rounds, standings } = parseStandings($);

    const payload = {
      title,
      series_id: seriesId,
      event_id: eventId,
      series,
      rounds,
      standings,
      timestamp: new Date().toISOString()
    };

    const ttl = liveMode(req) ? TTL_RACE_DAY_MS : TTL_OFF_DAY_MS;
    setCache(cacheKey, payload, ttl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/standings] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
