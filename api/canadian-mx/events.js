// api/canadian-mx/events.js
// Returns current event info + available race sessions for Triple Crown Series.
//
// GET /api/canadian-mx/events
//
// Response:
// {
//   "eventId": "24710",
//   "classes": [
//     { "key": "450", "label": "450 Pro", "qualifyingId": "84244", "accent": "#eb2127" },
//     { "key": "250", "label": "250 Pro", "qualifyingId": "84242", "accent": "#eb2127" },
//     { "key": "wmx", "label": "WMX",     "qualifyingId": "84246", "accent": "#29abe2" }
//   ],
//   "moto1Id": "82676",
//   "moto2Id": "82680",
//   "sessions": [
//     { "key": "q",  "label": "Qualifying" },
//     { "key": "m1", "label": "Moto 1"     },
//     { "key": "m2", "label": "Moto 2"     },
//     { "key": "ov", "label": "Overall"    }
//   ],
//   "liveTimingUrl": "https://triplecrownseries.ca/live"
// }

import {
  applyCors,
  scrapeEventConfig,
  fetchRaceState,
  getCached,
  setCache
} from '../../lib/canadianMxScraper.js';

const SESSIONS = [
  { key: 'q',  label: 'Qualifying' },
  { key: 'm1', label: 'Moto 1'     },
  { key: 'm2', label: 'Moto 2'     },
  { key: 'ov', label: 'Overall'    }
];

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const cacheKey = 'canadian_mx_events';
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json(cached);

    const config = await scrapeEventConfig();

    // Check which sessions have data published
    const sessionStatus = await Promise.all(
      config.allRaceIds.map(async (id) => {
        const state = await fetchRaceState(config.eventId, id);
        return {
          raceId: id,
          hasData: !!(state && state.results && state.results.length > 0),
          status: state?.race?.status || null,
          raceName: state?.race?.name || null
        };
      })
    );

    const response = {
      eventId: config.eventId,
      classes: config.classes,
      moto1Id: config.moto1Id,
      moto2Id: config.moto2Id,
      sessions: SESSIONS,
      sessionStatus,
      liveTimingUrl: 'https://triplecrownseries.ca/live',
      resultsUrl: 'https://triplecrownseries.ca/results',
      series: 'canadian_mx',
      seriesName: 'Triple Crown Series',
      season: 2026
    };

    setCache(cacheKey, response, 60 * 1000); // 1 min cache
    return res.status(200).json(response);

  } catch (err) {
    console.error('Canadian MX events error:', err);
    return res.status(500).json({ error: err.message });
  }
}
