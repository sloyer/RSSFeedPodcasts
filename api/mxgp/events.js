// api/mxgp/events.js
// GET /api/mxgp/events?year=2026&class=mxgp
//
// Returns the list of Grand Prix rounds available on results.mxgp.com for
// the requested year and class. Also returns available classes for that
// championship so the client can populate a class picker.
//
// Query params:
//   year   (default: current year)
//   class  (default: mxgp) — mxgp | mx1 | mx2 | emx | emx250 | emx125 | wmx
//
// Response:
//   { series, year, events: [{ event_id, name, selected }], classes: [...] }

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
  CSHIP_LABELS,
} from '../../lib/mxgpScraper.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const year   = String(req.query.year  || new Date().getFullYear());
  const cls    = normalizeClass(req.query.class);
  const config = getClassConfig(cls);

  const cacheKey = `mxgp:events:${year}:${cls}`;
  const cached   = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    // Step 1: GET initial page
    let html = await fetchReslistsPage();
    let formState = extractFormState(html);
    const current = extractCurrentSelections(html);

    // Step 2: POST if year or championship differs from what the server defaulted to
    const needPost =
      current.SelectYear !== year ||
      current.SelectCShip !== config.cship ||
      (config.classId && current.SelectClass !== config.classId);

    if (needPost) {
      html = await postReslists(formState, {
        __EVENTTARGET: 'SelectYear',
        SelectYear:   year,
        SelectCShip:  config.cship,
        SelectClass:  config.classId || current.SelectClass,
        SelectEvent:  current.SelectEvent,
        SelectRace:   current.SelectRace,
        SelectResult: current.SelectResult,
      });
      formState = extractFormState(html);
    }

    // Parse events (SelectEvent dropdown) and classes (SelectClass dropdown)
    const eventOpts = extractSelectOptions(html, 'SelectEvent');
    const classOpts = extractSelectOptions(html, 'SelectClass');
    const cshipOpts = extractSelectOptions(html, 'SelectCShip');

    const events = eventOpts.map((o) => ({
      event_id: o.value,
      name:     o.label,
    }));

    const classes = classOpts.map((o) => ({
      class_id: o.value,
      label:    o.label,
    }));

    const payload = {
      series:       CSHIP_LABELS[config.cship] || config.cship,
      year,
      class:        cls,
      championship: config.cship,
      events,
      classes,
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, payload, ONE_HOUR_MS);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[mxgp/events] error:', err);
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}
