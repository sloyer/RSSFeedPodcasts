// api/mxgp/sessions.js
// GET /api/mxgp/sessions?event_id=4109&class=mxgp&year=2026
//
// Returns all available sessions (races) for a specific MXGP event.
// Sessions include: Free Practice, Time Practice, Qualifying Race, Moto 1,
// Moto 2, and (where present) Overall GP Classification.
//
// Query params:
//   event_id  (required)
//   class     (default: mxgp)
//   year      (default: current year)
//
// Response:
//   { event_id, event_name, class, sessions: [{ race_id, name, type }] }

import {
  applyCors,
  extractFormState,
  extractSelectOptions,
  extractCurrentSelections,
  fetchReslistsPage,
  postReslists,
  getClassConfig,
  normalizeClass,
  getCached,
  setCache,
  liveMode,
} from '../../lib/mxgpScraper.js';

const TTL_RACE_DAY_MS = 60 * 1000;       // 1 min on race day (sessions change)
const TTL_OFF_DAY_MS  = 60 * 60 * 1000; // 1 hour off-day

function classifySession(name) {
  const n = (name || '').toLowerCase();
  // MXGP uses "Grand Prix Race 1" / "Grand Prix Race 2" for motos
  if (/race 1|moto 1/.test(n) && !/race 2/.test(n)) return 'moto1';
  if (/race 2|moto 2/.test(n)) return 'moto2';
  if (/qualifying race/.test(n))  return 'qualifying';
  if (/warm.?up/.test(n))         return 'warmup';
  if (/time practice/.test(n))    return 'time_practice';
  if (/free practice/.test(n))    return 'free_practice';
  if (/gp classification|overall|general/.test(n)) return 'overall';
  return 'other';
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });

  const year   = String(req.query.year || new Date().getFullYear());
  const cls    = normalizeClass(req.query.class);
  const config = getClassConfig(cls);
  const ttl    = liveMode(req) ? TTL_RACE_DAY_MS : TTL_OFF_DAY_MS;

  const cacheKey = `mxgp:sessions:${event_id}:${cls}:${year}`;
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

    // Step 2: POST selecting our event — this makes the server render the
    // race list for that specific event (EVENTVALIDATION locks race IDs per event).
    html = await postReslists(formState, {
      __EVENTTARGET: 'SelectEvent',
      SelectYear:   year,
      SelectCShip:  config.cship,
      SelectClass:  config.classId || current.SelectClass,
      SelectEvent:  event_id,
      SelectRace:   '',
      SelectResult: '1',
    });

    const raceOpts  = extractSelectOptions(html, 'SelectRace');
    const eventOpts = extractSelectOptions(html, 'SelectEvent');
    const eventName = eventOpts.find((o) => o.value === event_id)?.label || null;

    const sessions = raceOpts.map((o) => ({
      race_id: o.value,
      name:    o.label,
      type:    classifySession(o.label),
    }));

    const payload = {
      event_id,
      event_name: eventName,
      class: cls,
      year,
      sessions,
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, payload, ttl);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[mxgp/sessions] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
