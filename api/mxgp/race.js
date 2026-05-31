// api/mxgp/race.js
// GET /api/mxgp/race?event_id=4109&race_id=323&class=mxgp&year=2026&result_type=1
//
// Returns the full race classification for a specific MXGP session.
//
// Query params:
//   event_id    (required) — event ID from /api/mxgp/events
//   race_id     (required) — race/session ID from /api/mxgp/sessions
//   class       (default: mxgp)
//   year        (default: current year)
//   result_type (default: 1) — 1=Classification, 4=GP Overall, 5=Championship
//
// Response:
//   {
//     event_id, race_id, title, class,
//     results: [
//       { position, number, rider, riderId, nationality, federation, bike,
//         time, laps, diffFirst, diffPrev, bestLap, bestLapNum, speed, status }
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
  parseClassification,
  getCached,
  setCache,
  liveMode,
} from '../../lib/mxgpScraper.js';

const TTL_LIVE_MS     = 30 * 1000;         // 30 s — race in progress
const TTL_RACE_DAY_MS = 2  * 60 * 1000;   // 2 min — same day but race finished
const TTL_ARCHIVE_MS  = 24 * 60 * 60 * 1000; // 24 h — historical

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { event_id, race_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });
  if (!race_id)  return res.status(400).json({ error: 'race_id is required' });

  const year        = String(req.query.year || new Date().getFullYear());
  const cls         = normalizeClass(req.query.class);
  const config      = getClassConfig(cls);
  const resultType  = ['1','2','3','4'].includes(req.query.result_type) ? req.query.result_type : '1';
  const isLive      = liveMode(req);
  const effectiveTtl = isLive ? TTL_LIVE_MS : TTL_ARCHIVE_MS;

  const cacheKey = `mxgp:race:${event_id}:${race_id}:${cls}:${year}:rt${resultType}`;
  const cached   = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    // Step 1: GET initial page → VIEWSTATE
    let html = await fetchReslistsPage();
    let formState = extractFormState(html);
    const current = extractCurrentSelections(html);

    // Step 2: POST with target event selected — locks in race IDs for EVENTVALIDATION
    html = await postReslists(formState, {
      __EVENTTARGET: 'SelectEvent',
      SelectYear:   year,
      SelectCShip:  config.cship,
      SelectClass:  config.classId || current.SelectClass,
      SelectEvent:  event_id,
      SelectRace:   '',
      SelectResult: '1',
    });
    formState = extractFormState(html);

    // Capture event name while we have the event dropdown rendered
    const eventOpts = extractSelectOptions(html, 'SelectEvent');
    const eventName = eventOpts.find((o) => o.value === event_id)?.label || null;
    const raceOpts  = extractSelectOptions(html, 'SelectRace');
    const raceName  = raceOpts.find((o) => o.value === race_id)?.label || null;

    // Step 3: POST with target race + classification result type
    html = await postReslists(formState, {
      __EVENTTARGET: 'SelectRace',
      SelectYear:   year,
      SelectCShip:  config.cship,
      SelectClass:  config.classId || current.SelectClass,
      SelectEvent:  event_id,
      SelectRace:   race_id,
      SelectResult: resultType,
    });

    const { title, results } = parseClassification(html);

    const payload = {
      event_id,
      event_name: eventName,
      race_id,
      race_name:  raceName || title,
      title,
      class: cls,
      year,
      results,
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, payload, effectiveTtl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[mxgp/race] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
