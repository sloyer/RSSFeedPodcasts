// api/mxgp/standings.js
// GET /api/mxgp/standings?class=mxgp&year=2026&event_id=4109
//
// Returns the World Championship points standings table.
// Optionally scoped to a specific event (standings up to that round).
// If event_id is omitted, uses the latest event available for that year.
//
// Query params:
//   class     (default: mxgp) — mxgp | mx2 | emx | wmx | …
//   year      (default: current year)
//   event_id  (optional) — standings up to this GP round
//
// Response:
//   {
//     class, year, event_id, title,
//     roundHeaders: ['R01 - Argentina', …],
//     standings: [
//       { position, number, rider, nationality, bike,
//         totalPoints, roundResults: [{ round, label, points }] }
//     ]
//   }

import {
  applyCors,
  extractFormState,
  extractCurrentSelections,
  extractSelectOptions,
  fetchReslistsPage,
  postReslists,
  getClassConfig,
  normalizeClass,
  parseStandings,
  getCached,
  setCache,
  liveMode,
  RESULT_TYPE,
} from '../../lib/mxgpScraper.js';

const TTL_RACE_DAY_MS = 2 * 60 * 1000;    // 2 min — points update live race day
const TTL_OFF_DAY_MS  = 60 * 60 * 1000;  // 1 hour off-day

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const year   = String(req.query.year || new Date().getFullYear());
  const cls    = normalizeClass(req.query.class);
  const config = getClassConfig(cls);
  const ttl    = liveMode(req) ? TTL_RACE_DAY_MS : TTL_OFF_DAY_MS;

  const cacheKey = `mxgp:standings:${year}:${cls}:${req.query.event_id || 'latest'}`;
  const cached   = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    // Step 1: GET initial page → VIEWSTATE + default selections
    let html = await fetchReslistsPage();
    let formState = extractFormState(html);
    const current = extractCurrentSelections(html);

    // Step 2: If we need a different year or class, POST to update those
    const needYearClassSwitch =
      current.SelectYear !== year ||
      current.SelectCShip !== config.cship ||
      (config.classId && current.SelectClass !== config.classId);

    let eventId = req.query.event_id || null;

    if (needYearClassSwitch || eventId) {
      html = await postReslists(formState, {
        __EVENTTARGET: eventId ? 'SelectEvent' : 'SelectYear',
        SelectYear:   year,
        SelectCShip:  config.cship,
        SelectClass:  config.classId || current.SelectClass,
        SelectEvent:  eventId || current.SelectEvent,
        SelectRace:   current.SelectRace,
        SelectResult: RESULT_TYPE.standings,
      });
      formState = extractFormState(html);

      // If we didn't specify event_id, capture the first/default one
      if (!eventId) {
        const eventOpts = extractSelectOptions(html, 'SelectEvent');
        eventId = eventOpts.find((o) => o.selected)?.value || eventOpts[0]?.value || null;
      }
    } else {
      // Default page already shows right year/class — just switch to standings result type
      eventId = eventId || current.SelectEvent;
    }

    // Step 3: POST to get SelectResult=5 (World Championship Classification)
    html = await postReslists(formState, {
      __EVENTTARGET: 'SelectResult',
      SelectYear:   year,
      SelectCShip:  config.cship,
      SelectClass:  config.classId || current.SelectClass,
      SelectEvent:  eventId || current.SelectEvent,
      SelectRace:   current.SelectRace,
      SelectResult: RESULT_TYPE.standings,
    });

    const { title, roundHeaders, standings } = parseStandings(html);

    // Capture event name for context
    const eventOpts = extractSelectOptions(html, 'SelectEvent');
    const eventName = eventOpts.find((o) => o.value === eventId)?.label || null;

    const payload = {
      class: cls,
      year,
      event_id:   eventId,
      event_name: eventName,
      title,
      roundHeaders,
      standings,
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, payload, ttl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[mxgp/standings] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
