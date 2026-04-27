// api/race-results/series-list.js
// GET /api/race-results/series-list?event_id=NNN&series=smx
//
// Returns the list of championship series (e.g. "2026 SX 450 Championship")
// available for the given event. Falls back to a known SMX 2026 set if the
// scrape returns nothing.

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

const TTL_MS = 24 * 60 * 60 * 1000;

const FALLBACK_SMX_2026 = [
  { series_id: '14', name: '2026 SX 250 West Championship' },
  { series_id: '15', name: '2026 SX 250 East Championship' },
  { series_id: '16', name: '2026 SX 450 Championship' },
  { series_id: '17', name: '2026 SX Manufacturers Championship' },
  { series_id: '18', name: '2026 SMX 250 Combined Championship' },
  { series_id: '19', name: '2026 SMX 450 Combined Championship' }
];

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const series = normalizeSeries(req.query.series);
  const eventId = String(req.query.event_id || '').trim();
  if (!eventId || !/^\d+$/.test(eventId)) {
    return res.status(400).json({ error: 'event_id is required (numeric)' });
  }

  const cacheKey = `series-list:${series}:${eventId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const url = `${liveMxBase(series)}/results/?p=view_event&id=${eventId}`;
    const html = await fetchHtml(url);
    const $ = loadHtml(html);

    const seen = new Set();
    const championships = [];

    $('a[href*="view_series_points"]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const idM = href.match(/[?&]id=(\d+)/);
      if (!idM) return;
      const seriesIdParam = idM[1];
      if (seen.has(seriesIdParam)) return;
      const name = $a.text().trim();
      if (!name) return;
      seen.add(seriesIdParam);
      championships.push({ series_id: seriesIdParam, name });
    });

    const finalChampionships =
      championships.length > 0
        ? championships
        : series === 'smx'
        ? FALLBACK_SMX_2026
        : [];

    const payload = {
      event_id: eventId,
      series,
      championships: finalChampionships,
      fallback: championships.length === 0,
      timestamp: new Date().toISOString()
    };

    setCache(cacheKey, payload, TTL_MS);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/series-list] error:', err);
    // Return fallback even on error rather than failing the app
    if (series === 'smx') {
      return res.status(200).json({
        event_id: eventId,
        series,
        championships: FALLBACK_SMX_2026,
        fallback: true,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
