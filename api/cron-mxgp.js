// GET /api/cron-mxgp
//
// Race weekend (Sat/Sun 08-18 UTC): scrapes results.mxgp.com every 10 min
//   → classification results as each moto finishes, stored in Supabase
//
// Monday 10:00 UTC: scrapes racerxonline.com once
//   → final standings + completed event results (cleaner data)

import { createClient } from '@supabase/supabase-js';
import {
  // Racer X (historical)
  scrapeEvents,
  scrapeOverall,
  scrapeSession,
  scrapeStandings,
  CLASSES,
  // results.mxgp.com (live)
  fetchReslistsPage,
  postReslists,
  extractFormState,
  extractSelectOptions,
  parseClassification,
  raceNameToSlug,
  LIVE_CLASSES,
} from '../lib/mxgpScraper.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ttlMs(live = false) {
  if (live) return 8 * 60 * 1000;           // 8 min — refresh before next cron run
  const d = new Date().getUTCDay();
  return (d === 0 || d === 6) ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
}

async function upsert(key, data, live = false) {
  const expires = new Date(Date.now() + ttlMs(live)).toISOString();
  const { error } = await supabase.from('mxgp_cache').upsert(
    { key, data, fetched_at: new Date().toISOString(), expires_at: expires },
    { onConflict: 'key' },
  );
  if (error) console.error(`[cron-mxgp] upsert failed ${key}:`, error.message);
  else       console.log(`[cron-mxgp] stored ${key}`);
}

// ---------------------------------------------------------------------------
// LIVE MODE — results.mxgp.com (race weekend)
// Scrapes classification (result type=1) for MXGP and MX2.
// Never requests standings (type=5) — those 500 on in-progress events.
// ---------------------------------------------------------------------------

async function syncLive(year, stored, errors) {
  console.log('[cron-mxgp] LIVE mode — scraping results.mxgp.com');

  // Step 1: Load the page and get form state + current event options
  let pageHtml;
  try {
    pageHtml = await fetchReslistsPage();
  } catch (e) {
    errors.push(`live/fetch-page: ${e.message}`);
    return;
  }

  const formState = extractFormState(pageHtml);
  const eventOpts = extractSelectOptions(pageHtml, 'SelectEvent')
    .filter(o => o.value);

  if (!eventOpts.length) {
    errors.push('live: no events found in SelectEvent dropdown');
    return;
  }

  // Use the first event in the list (most recent / current)
  const eventId    = eventOpts[0].value;
  const eventLabel = eventOpts[0].label;
  console.log(`[cron-mxgp] current event: "${eventLabel}" (id=${eventId})`);

  // Step 2: Resolve the event slug from the Supabase events list
  // (populated by historical scrape — matches by date proximity to today)
  let eventSlug = null;
  try {
    const { data: evCache } = await supabase
      .from('mxgp_cache')
      .select('data')
      .eq('key', `rx:events:${year}`)
      .single();

    if (evCache?.data?.events) {
      const now = Date.now();
      // Find the event whose window includes today (±4 days)
      const match = evCache.data.events.find(ev => {
        if (!ev.startDate) return false;
        const start = new Date(ev.startDate).getTime();
        const end   = ev.endDate ? new Date(ev.endDate).getTime() : start + 2 * 86400000;
        return now >= start - 4 * 86400000 && now <= end + 4 * 86400000;
      });
      if (match) eventSlug = match.slug;
    }
  } catch {}

  if (!eventSlug) {
    // Derive a slug from the event label as fallback
    // e.g. "Liqui Moly MXGP of Germany" → "liqui-moly-mxgp-of-germany"
    eventSlug = eventLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    console.log(`[cron-mxgp] slug derived from label: ${eventSlug}`);
  } else {
    console.log(`[cron-mxgp] slug matched from DB: ${eventSlug}`);
  }

  // Step 3: For each class (MXGP, MX2) scrape all available races
  const discoveredSessions = {}; // cls → [sessionSlug, ...]

  for (const { cls, cship, classId } of LIVE_CLASSES) {
    discoveredSessions[cls] = [];

    // POST to switch to this class
    await sleep(600);
    let classHtml;
    try {
      classHtml = await postReslists(formState, {
        __EVENTTARGET: 'SelectClass',
        SelectYear: String(year), SelectCShip: cship, SelectClass: classId,
        SelectEvent: eventId, SelectRace: '', SelectResult: '1',
      });
    } catch (e) {
      errors.push(`live/switch-class/${cls}: ${e.message}`);
      continue;
    }

    const classState = extractFormState(classHtml);
    const raceOpts   = extractSelectOptions(classHtml, 'SelectRace').filter(o => o.value);

    if (!raceOpts.length) {
      console.log(`[cron-mxgp] no races available yet for ${cls}`);
      continue;
    }

    for (const race of raceOpts) {
      await sleep(600);
      const sessionSlug = raceNameToSlug(race.label);
      discoveredSessions[cls].push(sessionSlug);

      let raceHtml;
      try {
        raceHtml = await postReslists(classState, {
          __EVENTTARGET: 'SelectRace',
          SelectYear: String(year), SelectCShip: cship, SelectClass: classId,
          SelectEvent: eventId, SelectRace: race.value, SelectResult: '1',
        });
      } catch (e) {
        errors.push(`live/race/${cls}/${sessionSlug}: ${e.message}`);
        continue;
      }

      const parsed = parseClassification(raceHtml);
      if (!parsed.results.length) {
        console.log(`[cron-mxgp] ${cls}/${sessionSlug} — no results yet, skipping`);
        continue;
      }

      const key = `rx:session:${year}:${eventSlug}:${cls}:${sessionSlug}`;
      await upsert(key, { ...parsed, source: 'results.mxgp.com', eventSlug }, true);
      stored.push(key);
    }
  }

  // Step 4: Update the events list in Supabase to include discovered sessions
  // so the app knows what sessions exist for this event
  try {
    const { data: evCache } = await supabase
      .from('mxgp_cache')
      .select('data')
      .eq('key', `rx:events:${year}`)
      .single();

    if (evCache?.data?.events) {
      const events = evCache.data.events;
      const idx = events.findIndex(ev => ev.slug === eventSlug);
      if (idx >= 0) {
        // Merge discovered sessions into existing event
        for (const [cls, slugs] of Object.entries(discoveredSessions)) {
          if (!slugs.length) continue;
          const existing = new Set(events[idx].sessions[cls] || []);
          slugs.forEach(s => existing.add(s));
          events[idx].sessions[cls] = Array.from(existing).sort();
        }
        await upsert(`rx:events:${year}`, { year, events }, false);
        console.log(`[cron-mxgp] updated sessions for ${eventSlug} in events list`);
      }
    }
  } catch (e) {
    console.warn('[cron-mxgp] could not update events list:', e.message);
  }
}

// ---------------------------------------------------------------------------
// HISTORICAL MODE — racerxonline.com (post-race / Monday)
// Scrapes standings + completed event results.
// ---------------------------------------------------------------------------

async function syncHistorical(year, stored, errors) {
  console.log('[cron-mxgp] HISTORICAL mode — scraping racerxonline.com');

  // Events list
  let events = [];
  try {
    events = await scrapeEvents(year);
    await upsert(`rx:events:${year}`, { year, events });
    stored.push(`rx:events:${year}`);
  } catch (e) {
    errors.push(`events: ${e.message}`);
  }

  // Championship standings
  for (const cls of CLASSES) {
    await sleep(800);
    try {
      const data = await scrapeStandings(year, cls);
      const key  = `rx:standings:${year}:${cls}`;
      await upsert(key, data);
      stored.push(key);
    } catch (e) {
      errors.push(`standings/${cls}: ${e.message}`);
    }
  }

  // Per-event results — only last 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recent = events.filter(ev => {
    if (!Object.values(ev.sessions || {}).some(a => a.length > 0)) return false;
    return !ev.endDate || ev.endDate >= cutoff;
  });

  console.log(`[cron-mxgp] ${recent.length} recent events to backfill`);

  for (const ev of recent) {
    for (const cls of CLASSES) {
      if (!ev.sessions[cls]) continue;
      await sleep(800);
      try {
        const data = await scrapeOverall(year, ev.slug, cls);
        await upsert(`rx:overall:${year}:${ev.slug}:${cls}`, data);
        stored.push(`rx:overall:${year}:${ev.slug}:${cls}`);
      } catch (e) {
        errors.push(`overall/${ev.slug}/${cls}: ${e.message}`);
      }

      for (const session of ev.sessions[cls]) {
        await sleep(800);
        try {
          const data = await scrapeSession(year, ev.slug, cls, session);
          await upsert(`rx:session:${year}:${ev.slug}:${cls}:${session}`, data);
          stored.push(`rx:session:${year}:${ev.slug}:${cls}:${session}`);
        } catch (e) {
          errors.push(`session/${ev.slug}/${cls}/${session}: ${e.message}`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const year    = parseInt(req.query.year) || new Date().getFullYear();
  const dayUTC  = new Date().getUTCDay(); // 0=Sun 1=Mon … 6=Sat
  const isWeekend = dayUTC === 0 || dayUTC === 6;

  // Allow manual override: ?mode=live or ?mode=historical
  const mode = req.query.mode || (isWeekend ? 'live' : 'historical');

  const stored = [];
  const errors = [];

  try {
    if (mode === 'live') {
      await syncLive(year, stored, errors);
    } else {
      await syncHistorical(year, stored, errors);
    }

    return res.status(200).json({
      ok: true, mode, year,
      stored: stored.length, errors: errors.length,
      errorList: errors, keys: stored,
    });
  } catch (e) {
    console.error('[cron-mxgp] fatal:', e);
    return res.status(500).json({ error: e.message });
  }
}
