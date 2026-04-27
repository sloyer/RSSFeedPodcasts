// api/race-results/events.js
// GET /api/race-results/events?series=smx&season=2026
//
// Series values:
//   smx (default) | sx          -> Supercross (smx.livemx.com)
//   mx                          -> Pro Motocross (results.promotocross.com)
//   smx_playoffs | playoffs     -> SMX Playoffs (results.supermotocross.com,
//                                  filtered to "SMX Playoff …" rounds)
//
// All three upstreams share the same LiveMX HTML structure: a single events
// table with two columns, "Event Name" (an <a> linking to view_event) and
// "Date" (e.g. "May 24, 2025" or "Aug 22, 2025 to Aug 23, 2025"). We use the
// date column for season filtering and (for series without a hardcoded round
// map) to derive round numbers in chronological order.

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

// Anchored event_id -> round# for the current SX (smx) season. LiveMX doesn't
// expose round numbers directly, so we pin them for stability. New seasons
// fall back to chronological ordering using the date column.
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

// Sub-events on the MX page that aren't full championship rounds — they
// run alongside the round but get their own event_id. We expose them in the
// payload under a separate `subEvents` field so the app can still see them
// without polluting the round-numbered list.
const MX_SUB_EVENT_PATTERNS = [/^moto combine\b/i, /^wmx\b/i];

// Earliest year on file (avoids matching the 2024 in copyright footers etc.).
const SEASON_RE = /\b(20\d{2})\b/;

function parseYearFromDate(dateStr) {
  if (!dateStr) return null;
  const m = SEASON_RE.exec(dateStr);
  return m ? m[1] : null;
}

function parseDateMs(dateStr) {
  if (!dateStr) return null;
  // "May 24, 2025"  or  "Aug 22, 2025 to Aug 23, 2025"  -> first half
  const first = dateStr.split(/\s*to\s*/i)[0].trim();
  const ms = Date.parse(first);
  return Number.isFinite(ms) ? ms : null;
}

function isSubEvent(name) {
  return MX_SUB_EVENT_PATTERNS.some((re) => re.test(name));
}

function isPlayoffEvent(name) {
  return /^smx\s+playoff\b/i.test(name);
}

function playoffRoundFromName(name) {
  const m = name.match(/^smx\s+playoff\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

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

      let name = $a.text().trim();
      if (!name) name = $a.parent().text().trim();
      if (!name) return;

      // Date lives in the sibling <td> in the same <tr>.
      let date = null;
      const $row = $a.closest('tr');
      if ($row.length) {
        const tds = $row.children('td');
        // Prefer the last cell that looks like a date.
        tds.each((_i, td) => {
          const txt = $(td).text().trim();
          if (txt && SEASON_RE.test(txt)) date = txt;
        });
      }

      seen.add(id);
      allEvents.push({ event_id: id, name, date });
    });

    // ---- Per-series filtering / round assignment -----------------------------

    let events = [];
    let subEvents = [];

    if (series === 'smx_playoffs') {
      // Source page mixes everything; keep only "SMX Playoff N - …" rows.
      events = allEvents
        .filter((e) => isPlayoffEvent(e.name))
        .filter((e) => {
          const yr = parseYearFromDate(e.date);
          return yr ? yr === season : false;
        })
        .map((e) => ({
          event_id: e.event_id,
          name: e.name,
          date: e.date || null,
          round: playoffRoundFromName(e.name)
        }));
      events.sort((a, b) => (a.round ?? 999) - (b.round ?? 999));
    } else if (series === 'mx') {
      // Pro Motocross. No hardcoded round map — derive rounds in chronological
      // order from the date column, skipping sub-events (Moto Combine, WMX).
      const inSeason = allEvents.filter((e) => {
        const yr = parseYearFromDate(e.date);
        return yr ? yr === season : false;
      });

      const mainRounds = inSeason.filter((e) => !isSubEvent(e.name));
      const sub = inSeason.filter((e) => isSubEvent(e.name));

      mainRounds.sort((a, b) => {
        const am = parseDateMs(a.date) ?? 0;
        const bm = parseDateMs(b.date) ?? 0;
        return am - bm; // ascending by date -> round 1 first
      });
      events = mainRounds.map((e, idx) => ({
        event_id: e.event_id,
        name: e.name,
        date: e.date || null,
        round: idx + 1
      }));

      subEvents = sub.map((e) => ({
        event_id: e.event_id,
        name: e.name,
        date: e.date || null
      }));
    } else {
      // 'smx' (legacy SX default) and 'sx' both fall through here.
      const knownMap = KNOWN_ROUND_MAPS[`smx:${season}`] || KNOWN_ROUND_MAPS[`${series}:${season}`] || null;

      const inSeason = allEvents.filter((e) => {
        if (knownMap && knownMap[e.event_id] !== undefined) return true;
        const yr = parseYearFromDate(e.date);
        return yr ? yr === season : false;
      });

      events = inSeason.map((e) => {
        const out = { event_id: e.event_id, name: e.name };
        if (e.date) out.date = e.date;
        if (knownMap && knownMap[e.event_id] !== undefined) out.round = knownMap[e.event_id];
        return out;
      });

      const hasAnyRound = events.some((e) => e.round);
      if (!hasAnyRound) {
        // Newer season without a hardcoded map: derive round# from chrono order.
        events.sort((a, b) => (parseDateMs(a.date) ?? 0) - (parseDateMs(b.date) ?? 0));
        events = events.map((e, idx) => ({ ...e, round: idx + 1 }));
      } else {
        events.sort((a, b) => {
          if (a.round && b.round) return a.round - b.round;
          if (a.round) return -1;
          if (b.round) return 1;
          return 0;
        });
      }
    }

    const payload = {
      series,
      season,
      events,
      timestamp: new Date().toISOString()
    };
    if (subEvents.length) payload.subEvents = subEvents;

    setCache(cacheKey, payload, ONE_HOUR_MS);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/events] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
