// api/race-results/sessions.js
// GET /api/race-results/sessions?event_id=NNN&series=smx&live=true?
//
// Scrapes the LiveMX event detail page and returns every session (qualifying,
// heats, LCQs, mains) with the IDs needed to fetch its full result.

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  classifySessionType,
  classifySessionClass,
  liveMode,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

const TTL_RACE_DAY_MS = 60 * 1000;
const TTL_OFF_DAY_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const series = normalizeSeries(req.query.series);
  const event_id = String(req.query.event_id || '').trim();
  if (!event_id || !/^\d+$/.test(event_id)) {
    return res.status(400).json({ error: 'event_id is required (numeric)' });
  }

  const cacheKey = `sessions:${series}:${event_id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const url = `${liveMxBase(series)}/results/?p=view_event&id=${event_id}`;
    const html = await fetchHtml(url);
    const $ = loadHtml(html);

    // Event name from the most prominent heading on the page
    const eventName =
      $('h1').first().text().trim() ||
      $('h2').first().text().trim() ||
      $('h3').first().text().trim() ||
      null;

    const byRaceId = new Map();

    $('a[href]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const text = $a.text().trim();
      if (!text) return;

      // Heat sheet: takes priority over race_result if both seen for same race_id
      const heatM = href.match(/p=view_heat_sheet&[^"']*?id=(\d+)[^"']*?race_id=(\d+)/i) ||
                    href.match(/p=view_heat_sheet[^"']*?race_id=(\d+)[^"']*?id=(\d+)/i);
      if (heatM) {
        // Disambiguate: original spec form is id=SHEET, race_id=RACE
        let sheetId, raceId;
        const m1 = href.match(/[?&]id=(\d+)/);
        const m2 = href.match(/race_id=(\d+)/);
        sheetId = m1 ? m1[1] : null;
        raceId = m2 ? m2[1] : null;
        if (!raceId || !sheetId) return;

        if (!byRaceId.has(raceId)) {
          byRaceId.set(raceId, {
            id: raceId,
            name: text,
            type: classifySessionType(text),
            class: classifySessionClass(text),
            url_type: 'heat_sheet',
            sheet_id: sheetId
          });
        }
        return;
      }

      // Race result: heats / LCQs / mains with full lap data
      const raceM = href.match(/p=view_race_result[^"']*?[?&]id=(\d+)/i);
      if (raceM) {
        const raceId = raceM[1];
        if (!byRaceId.has(raceId)) {
          byRaceId.set(raceId, {
            id: raceId,
            name: text,
            type: classifySessionType(text),
            class: classifySessionClass(text),
            url_type: 'race_result'
          });
        } else {
          // If we already have a heat_sheet entry but the page also exposes a
          // race_result link for the same race_id, prefer race_result.
          const existing = byRaceId.get(raceId);
          if (existing.url_type === 'heat_sheet') {
            byRaceId.set(raceId, {
              id: raceId,
              name: text,
              type: classifySessionType(text),
              class: classifySessionClass(text),
              url_type: 'race_result'
            });
          }
        }
        return;
      }
    });

    // Order: qualifying first, heats, lcq, semi, main, other
    const typeOrder = { qualifying: 0, qualifying_combined: 1, heat: 2, semi: 3, lcq: 4, main: 5, other: 6 };
    const sessions = Array.from(byRaceId.values()).sort((a, b) => {
      const ta = typeOrder[a.type] ?? 9;
      const tb = typeOrder[b.type] ?? 9;
      if (ta !== tb) return ta - tb;
      // Within a type: 250 before 450
      if (a.class !== b.class) {
        if (a.class === '250') return -1;
        if (b.class === '250') return 1;
      }
      return a.name.localeCompare(b.name);
    });

    const payload = {
      event_id,
      event_name: eventName,
      series,
      sessions,
      timestamp: new Date().toISOString()
    };

    const ttl = liveMode(req) ? TTL_RACE_DAY_MS : TTL_OFF_DAY_MS;
    setCache(cacheKey, payload, ttl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/sessions] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
