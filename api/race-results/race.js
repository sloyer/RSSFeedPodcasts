// api/race-results/race.js
// GET /api/race-results/race?id=NNN&series=smx&type=race_result|heat_sheet&sheet_id=NNN
//
// Returns the full result for a single race. For race_result pages this
// includes per-rider lap-by-lap data extracted from the embedded racerLaps
// JS object. For heat_sheet pages it returns the simple grid table.

import {
  applyCors,
  fetchHtml,
  loadHtml,
  liveMxBase,
  normalizeSeries,
  parseRacerLapsOrdered,
  parseDriverNames,
  parseResultsTable,
  parseHeatSheetTable,
  liveMode,
  getCached,
  setCache
} from '../../lib/raceResultsScraper.js';

const TTL_FINISHED_MS = 24 * 60 * 60 * 1000;
const TTL_LIVE_MS = 30 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const series = normalizeSeries(req.query.series);
  const id = String(req.query.id || '').trim();
  const type = (req.query.type || 'race_result').toString();
  const sheetId = req.query.sheet_id ? String(req.query.sheet_id).trim() : null;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'id is required (numeric race_id)' });
  }
  if (type !== 'race_result' && type !== 'heat_sheet') {
    return res.status(400).json({ error: 'type must be race_result or heat_sheet' });
  }
  if (type === 'heat_sheet' && (!sheetId || !/^\d+$/.test(sheetId))) {
    return res.status(400).json({ error: 'sheet_id is required when type=heat_sheet' });
  }

  const cacheKey = `race:${series}:${type}:${id}:${sheetId || ''}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  const ttl = liveMode(req) ? TTL_LIVE_MS : TTL_FINISHED_MS;
  const base = liveMxBase(series);
  const url =
    type === 'heat_sheet'
      ? `${base}/results/?p=view_heat_sheet&id=${sheetId}&race_id=${id}`
      : `${base}/results/?p=view_race_result&id=${id}`;

  try {
    const html = await fetchHtml(url);
    const $ = loadHtml(html);

    const name =
      $('h1').first().text().trim() ||
      $('h2').first().text().trim() ||
      $('h3').first().text().trim() ||
      null;

    const eventName = extractEventName($, name);

    if (type === 'heat_sheet') {
      const results = parseHeatSheetTable($);
      const payload = {
        race_id: id,
        sheet_id: sheetId,
        name,
        event_name: eventName,
        series,
        url_type: 'heat_sheet',
        results,
        totalRiders: results.length,
        timestamp: new Date().toISOString()
      };
      setCache(cacheKey, payload, ttl);
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(payload);
    }

    // race_result branch
    const tableRows = parseResultsTable($);
    const orderedLaps = parseRacerLapsOrdered(html); // [{driverId, laps}] in HTML order
    const driverNames = parseDriverNames(html);       // ordered array, same insertion order

    // Build rider-name -> {driverId, laps} via insertion-order pairing.
    // LiveMX emits driverNames.push(NAME) immediately followed by
    // racerLaps[ID] = {...} for the same rider, so positions match.
    const lapsByName = {};
    const lapsByDriverId = {};
    orderedLaps.forEach((entry, i) => {
      lapsByDriverId[entry.driverId] = entry.laps;
      const name = driverNames[i];
      if (name) lapsByName[canonicalName(name)] = { driverId: entry.driverId, laps: entry.laps };
    });

    // Match table rows to lap data by canonical rider name first; fall back to
    // sequential pairing for anything unmatched (e.g. LiveMX renders names
    // slightly differently in the summary table vs. the lap chart).
    const usedDriverIds = new Set();
    const rowAssoc = tableRows.map((row) => {
      const key = canonicalName(row.rider);
      const hit = lapsByName[key];
      if (hit) {
        usedDriverIds.add(hit.driverId);
        return hit.driverId;
      }
      return null;
    });
    // Sequential fallback for unmatched rows
    let cursor = 0;
    for (let i = 0; i < rowAssoc.length; i++) {
      if (rowAssoc[i]) continue;
      while (cursor < orderedLaps.length && usedDriverIds.has(orderedLaps[cursor].driverId)) cursor++;
      if (cursor < orderedLaps.length) {
        rowAssoc[i] = orderedLaps[cursor].driverId;
        usedDriverIds.add(orderedLaps[cursor].driverId);
        cursor++;
      }
    }

    const results = tableRows.map((row, idx) => {
      const driverId = rowAssoc[idx];
      const laps = driverId && lapsByDriverId[driverId] ? lapsByDriverId[driverId] : [];

      // Best lap: skip lap 0 (grid position) AND lap 1 (start sprint — riders
      // don't run a full lap until they cross the finish line for the first
      // time). LiveMX excludes the start lap from "best lap" too.
      let bestLap = null;
      let bestLapNum = null;
      let startPosition = null;
      for (const lap of laps) {
        if (lap.lap === 0) {
          startPosition = lap.pos;
          continue;
        }
        if (lap.lap === 1) continue; // partial start lap — never count
        if (lap.time !== null && (bestLap === null || lap.time < bestLap)) {
          bestLap = lap.time;
          bestLapNum = lap.lap;
        }
      }

      // LiveMX renders an authoritative "BEST LAP (LAP #)" cell — parse it as
      // the source of truth and use the computed value as a sanity-check
      // fallback when the cell is empty/garbled.
      const displayed = parseBestLapDisplay(row.bestLapDisplay);
      if (displayed) {
        bestLap = displayed.time;
        bestLapNum = displayed.lap;
      }

      return {
        ...row,
        startPosition,
        bestLap,
        bestLapNum,
        laps
      };
    });

    // Overall fastest lap across all riders
    let fastestLap = null;
    for (const r of results) {
      if (r.bestLap !== null && (fastestLap === null || r.bestLap < fastestLap.time)) {
        fastestLap = {
          rider: r.rider,
          number: r.number,
          time: r.bestLap,
          lap: r.bestLapNum
        };
      }
    }

    const totalLaps = results.reduce((max, r) => {
      const local = r.laps.reduce((mx, lap) => Math.max(mx, lap.lap || 0), 0);
      return Math.max(max, local);
    }, 0);

    const payload = {
      race_id: id,
      name,
      event_name: eventName,
      series,
      url_type: 'race_result',
      results,
      fastestLap,
      totalLaps,
      totalRiders: results.length,
      timestamp: new Date().toISOString()
    };

    setCache(cacheKey, payload, ttl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[race-results/race] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}

// Try to extract a sub-event name like "Anaheim 1" from the page.
// LiveMX often shows "Cleveland :: Apr 18, 2026" or similar in a sub-heading.
function extractEventName($, primaryHeading) {
  // Look for a <h2>/<h3> that's different from primary heading and looks like an event name
  const candidates = ['h2', 'h3', '.event-name', '.event_name'];
  for (const sel of candidates) {
    const txt = $(sel).first().text().trim();
    if (!txt) continue;
    if (txt === primaryHeading) continue;
    if (/^\d/.test(txt)) continue; // likely a points line
    // Strip "::" and trailing date if present
    const m = txt.match(/^([^:]+?)(?:\s*::\s*.*)?$/);
    if (m) return m[1].trim();
  }
  return null;
}

function canonicalName(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z, ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse strings like "1:07.436 (8)" -> { time: 67.436, lap: 8 }
function parseBestLapDisplay(s) {
  if (!s) return null;
  const m = String(s).match(/(?:(\d+):)?([\d.]+)\s*\((\d+)\)/);
  if (!m) return null;
  const minutes = m[1] ? parseFloat(m[1]) : 0;
  const seconds = parseFloat(m[2]);
  const lap = parseInt(m[3], 10);
  if (!Number.isFinite(seconds) || !Number.isFinite(lap)) return null;
  return { time: minutes * 60 + seconds, lap };
}
