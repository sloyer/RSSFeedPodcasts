// api/cron-mxgp.js
// Cron job that scrapes results.mxgp.com and stores everything in Supabase.
// API endpoints (/api/mxgp/*) read from the DB — zero live scraping per user request.
//
// Schedule: every 15 min on weekends (race days), every 2 hours otherwise.
// Data fetched per run:
//   - Events list for current year, MXGP + MX2
//   - Sessions for the 2 most recent events (completed + in-progress)
//   - Race results for all sessions of those events
//   - Championship standings for MXGP + MX2
//   - EMX/WMX standings when available

import { createClient } from '@supabase/supabase-js';
import {
  fetchReslistsPage,
  postReslists,
  extractFormState,
  extractCurrentSelections,
  extractSelectOptions,
  parseClassification,
  parseStandings,
  CLASS_CONFIG,
  RESULT_TYPE,
} from '../lib/mxgpScraper.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function dbSet(key, data, ttlSeconds = 3600) {
  const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabase
    .from('mxgp_cache')
    .upsert({ key, data, fetched_at: new Date().toISOString(), expires_at }, { onConflict: 'key' });
  if (error) console.error(`[cron-mxgp] dbSet error for ${key}:`, error.message);
}

// ---------------------------------------------------------------------------
// Scrape helpers
// ---------------------------------------------------------------------------

// Fetch events list for a year+class, returns { html, formState, events, classId, cship }
async function fetchEventsPage(year, cship, classId) {
  const html = await fetchReslistsPage();
  const formState = extractFormState(html);
  const current   = extractCurrentSelections(html);

  const needSwitch = current.SelectYear !== year
    || current.SelectCShip !== cship
    || (classId && current.SelectClass !== classId);

  let eventsHtml = html;
  let eventsFormState = formState;

  if (needSwitch) {
    eventsHtml = await postReslists(formState, {
      __EVENTTARGET: 'SelectYear',
      SelectYear:   year,
      SelectCShip:  cship,
      SelectClass:  classId || current.SelectClass,
      SelectEvent:  current.SelectEvent,
      SelectRace:   current.SelectRace,
      SelectResult: '1',
    });
    eventsFormState = extractFormState(eventsHtml);
  }

  const events  = extractSelectOptions(eventsHtml, 'SelectEvent');
  const classes = extractSelectOptions(eventsHtml, 'SelectClass');
  return { html: eventsHtml, formState: eventsFormState, events, classes, current: extractCurrentSelections(eventsHtml) };
}

// Fetch sessions for a specific event
async function fetchSessionsForEvent(formState, current, year, cship, classId, eventId) {
  const html = await postReslists(formState, {
    __EVENTTARGET: 'SelectEvent',
    SelectYear:   year,
    SelectCShip:  cship,
    SelectClass:  classId || current.SelectClass,
    SelectEvent:  eventId,
    SelectRace:   '',
    SelectResult: '1',
  });
  const newFormState = extractFormState(html);
  const races = extractSelectOptions(html, 'SelectRace');
  return { html, formState: newFormState, races };
}

// Fetch race classification for a specific race
async function fetchRaceResult(formState, current, year, cship, classId, eventId, raceId) {
  const html = await postReslists(formState, {
    __EVENTTARGET: 'SelectRace',
    SelectYear:   year,
    SelectCShip:  cship,
    SelectClass:  classId || current.SelectClass,
    SelectEvent:  eventId,
    SelectRace:   raceId,
    SelectResult: '1',
  });
  return parseClassification(html);
}

// Fetch standings.
// ASP.NET only processes ONE control's change per postback (via __EVENTTARGET).
// To switch both class and result type we need two sequential POSTs.
// POST 1: switch SelectClass → new VIEWSTATE with correct class active.
// POST 2: switch SelectResult=5 → standings HTML.
// If the class already matches the current VIEWSTATE we skip POST 1.
async function fetchStandings(formState, current, year, cship, classId, eventId) {
  let fs = formState;
  const targetClass = classId || current.SelectClass;

  if (targetClass !== current.SelectClass) {
    const html1 = await postReslists(fs, {
      __EVENTTARGET: 'SelectClass',
      SelectYear:   year,
      SelectCShip:  cship,
      SelectClass:  targetClass,
      SelectEvent:  eventId,
      SelectRace:   current.SelectRace,
      SelectResult: '1',
    });
    fs = extractFormState(html1);
  }

  const html2 = await postReslists(fs, {
    __EVENTTARGET: 'SelectResult',
    SelectYear:   year,
    SelectCShip:  cship,
    SelectClass:  targetClass,
    SelectEvent:  eventId,
    SelectRace:   current.SelectRace,
    SelectResult: RESULT_TYPE.standings,
  });
  return parseStandings(html2);
}

// Classify session type from name
function classifySession(name) {
  const n = (name || '').toLowerCase();
  if (/race 1|moto 1/.test(n) && !/race 2/.test(n)) return 'moto1';
  if (/race 2|moto 2/.test(n)) return 'moto2';
  if (/qualifying race/.test(n)) return 'qualifying';
  if (/warm.?up/.test(n))        return 'warmup';
  if (/time practice/.test(n))   return 'time_practice';
  if (/free practice/.test(n))   return 'free_practice';
  if (/gp classification|overall/.test(n)) return 'overall';
  return 'other';
}

// ---------------------------------------------------------------------------
// Main sync logic
// ---------------------------------------------------------------------------

async function syncClass(year, cls, config, eventsToSync = 2) {
  const { cship, classId, label } = config;
  console.log(`[cron-mxgp] Syncing ${label} ${year}...`);

  // 1. Events list
  const { html: evHtml, formState: evFormState, events, classes, current } =
    await fetchEventsPage(year, cship, classId);

  const eventsPayload = {
    series: label,
    year,
    class: cls,
    championship: cship,
    events: events.map((o) => ({ event_id: o.value, name: o.label })),
    classes: classes.map((o) => ({ class_id: o.value, label: o.label })),
    timestamp: new Date().toISOString(),
  };
  await dbSet(`mxgp:events:${year}:${cls}`, eventsPayload, 2 * 3600);
  console.log(`[cron-mxgp] ${label} events saved (${events.length} rounds)`);

  // 2. Standings
  try {
    const standingsData = await fetchStandings(evFormState, current, year, cship, classId, current.SelectEvent);
    const standingsPayload = {
      class: cls,
      year,
      event_id:   current.SelectEvent,
      event_name: events.find((e) => e.value === current.SelectEvent)?.label || null,
      ...standingsData,
      timestamp: new Date().toISOString(),
    };
    await dbSet(`mxgp:standings:${year}:${cls}:latest`, standingsPayload, 2 * 3600);
    console.log(`[cron-mxgp] ${label} standings saved (${standingsData.standings?.length ?? 0} riders)`);
  } catch (err) {
    console.error(`[cron-mxgp] standings error for ${label}:`, err.message);
  }

  // 3. Sessions + race results for the N most recent events
  const recentEvents = events.slice(0, eventsToSync);
  for (const event of recentEvents) {
    try {
      const { formState: sessFormState, races, html: sessHtml } =
        await fetchSessionsForEvent(evFormState, current, year, cship, classId, event.value);

      const sessionsPayload = {
        event_id:   event.value,
        event_name: event.label,
        class: cls,
        year,
        sessions: races.map((r) => ({ race_id: r.value, name: r.label, type: classifySession(r.label) })),
        timestamp: new Date().toISOString(),
      };
      await dbSet(`mxgp:sessions:${event.value}:${cls}:${year}`, sessionsPayload, 2 * 3600);
      console.log(`[cron-mxgp] ${label} ${event.label} sessions saved (${races.length})`);

      // Fetch results for each race session
      const sessFormStateCurrent = extractCurrentSelections(sessHtml);
      for (const race of races) {
        const type = classifySession(race.label);
        // Skip practice sessions for archives — only fetch timed sessions + motos
        if (['free_practice', 'warmup', 'other'].includes(type)) continue;

        try {
          const result = await fetchRaceResult(
            sessFormState,
            sessFormStateCurrent,
            year, cship, classId,
            event.value, race.value
          );
          const racePayload = {
            event_id:   event.value,
            event_name: event.label,
            race_id:    race.value,
            race_name:  race.label,
            title:      result.title,
            class: cls,
            year,
            results:    result.results,
            timestamp:  new Date().toISOString(),
          };
          const raceTtl = result.results?.length ? 24 * 3600 : 5 * 60;
          await dbSet(`mxgp:race:${event.value}:${race.value}:${cls}:${year}:rt1`, racePayload, raceTtl);
          console.log(`[cron-mxgp] ${label} ${event.label} / ${race.label} saved (${result.results?.length ?? 0} riders)`);
        } catch (err) {
          console.error(`[cron-mxgp] race error ${event.value}/${race.value}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[cron-mxgp] sessions error for ${event.label}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // Allow manual trigger via GET with optional ?force=1
  const authorized =
    req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}` ||
    req.query.force === '1';

  if (!authorized && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const year = String(req.query.year || new Date().getFullYear());

  // How many recent events to sync race results for
  // On race day sync more aggressively
  const now = new Date();
  const day = now.getUTCDay();
  const isRaceDay = day === 0 || day === 6;
  const eventsToSync = isRaceDay ? 3 : 2;

  const results = { synced: [], errors: [] };

  // Sync MXGP and MX2 (the main classes)
  for (const [cls, config] of [['mxgp', CLASS_CONFIG.mxgp], ['mx2', CLASS_CONFIG.mx2]]) {
    try {
      await syncClass(year, cls, config, eventsToSync);
      results.synced.push(cls);
    } catch (err) {
      console.error(`[cron-mxgp] syncClass failed for ${cls}:`, err.message);
      results.errors.push({ cls, error: err.message });
    }
  }

  console.log(`[cron-mxgp] done. synced=${results.synced.join(',')} errors=${results.errors.length}`);
  return res.status(200).json({ ok: true, year, isRaceDay, ...results });
}
