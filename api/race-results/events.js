// api/race-results/events.js
// GET /api/race-results/events?series=smx&season=2026
//
// Scrapes https://{series}.livemx.com/events/ and returns the list of events
// for a given series/season with stable round numbers (where known).

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

// Hardcoded round numbers for the 2026 SMX season we know about.
// LiveMX doesn't expose round numbers directly, so we anchor known event_ids.
const KNOWN_ROUND_MAPS = {
  'smx:2026': {
    '487830': 1,  // Anaheim 1
    '492375': 2,  // San Diego
    '493099': 3,  // Anaheim 2
    '493648': 4,  // Houston
    '494425': 5,  // Glendale
    '495073': 6,  // Seattle
    '495765': 7,  // Arlington
    '496545': 8,  // Daytona Beach
    '497316': 9,  // Indianapolis
    '498132': 10, // Birmingham
    '499659': 11, // Detroit
    '500586': 12, // St. Louis
    '501177': 13, // Nashville
    '501982': 14, // Cleveland
    '502700': 15, // Philadelphia
    '503469': 16  // Denver
  }
};

const ONE_HOUR_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const series = normalizeSeries(req.query.series);
  const season = String(req.query.season || '2026');

  const cacheKey = `events:${series}:${season}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const url = `${liveMxBase(series)}/events/`;
    const html = await fetchHtml(url);
    const $ = loadHtml(html);

    const seen = new Set();
    const allEvents = [];

    $('a[href*="view_event"]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const idMatch = href.match(/[?&]id=(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;

      // Use the anchor text as the event name; fall back to enclosing text if empty.
      let name = $a.text().trim();
      if (!name) {
        name = $a.parent().text().trim();
      }
      if (!name) return;

      // Try to grab a date string from a sibling cell, if present.
      let date = null;
      const $row = $a.closest('tr');
      if ($row.length) {
        const dateText = $row.find('td').last().text().trim();
        if (dateText && /\d{4}/.test(dateText)) date = dateText;
      }

      seen.add(id);
      allEvents.push({ event_id: id, name, date });
    });

    // Filter by season — keep events whose name or date contains the season year,
    // or whose event_id is in the known round map for this series/season.
    const knownMap = KNOWN_ROUND_MAPS[`${series}:${season}`] || null;
    const events = allEvents
      .filter((e) => {
        if (knownMap && knownMap[e.event_id] !== undefined) return true;
        const blob = `${e.name} ${e.date || ''}`;
        return blob.includes(season);
      })
      .map((e) => {
        const out = { event_id: e.event_id, name: e.name };
        if (e.date) out.date = e.date;
        if (knownMap && knownMap[e.event_id] !== undefined) {
          out.round = knownMap[e.event_id];
        }
        return out;
      });

    // Sort by round if we have it, otherwise leave page-order
    events.sort((a, b) => {
      if (a.round && b.round) return a.round - b.round;
      if (a.round) return -1;
      if (b.round) return 1;
      return 0;
    });

    const payload = {
      series,
      season,
      events,
      timestamp: new Date().toISOString()
    };

    setCache(cacheKey, payload, ONE_HOUR_MS);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/events] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
