// GET /api/cron-mxgp
// Scheduled cron: scrapes racerxonline.com and writes results into Supabase mxgp_cache.
// API endpoints (/api/mxgp/*) read straight from that cache — no live scraping on user requests.

import { createClient } from '@supabase/supabase-js';
import {
  scrapeEvents,
  scrapeOverall,
  scrapeSession,
  scrapeStandings,
  CLASSES,
} from '../lib/mxgpScraper.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Pause between outbound requests to be a polite scraper
const POLITE_DELAY_MS = 800;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

// TTL: 15 min on race weekend (Sat/Sun), 6 hours otherwise
function ttlMs() {
  const d = new Date().getUTCDay();
  return (d === 0 || d === 6) ? 15 * 60 * 1000 : 6 * 60 * 60 * 1000;
}

async function upsert(key, data) {
  const expires = new Date(Date.now() + ttlMs()).toISOString();
  const { error } = await supabase.from('mxgp_cache').upsert(
    { key, data, fetched_at: new Date().toISOString(), expires_at: expires },
    { onConflict: 'key' },
  );
  if (error) console.error(`[cron-mxgp] upsert failed for ${key}:`, error.message);
  else console.log(`[cron-mxgp] stored ${key}`);
}

export default async function handler(req, res) {
  // Allow manual trigger from Vercel dashboard or curl
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const errors = [];
  const stored = [];

  try {
    // ── 1. Events list ───────────────────────────────────────────────────────
    console.log(`[cron-mxgp] Scraping events for ${year}…`);
    let events = [];
    try {
      events = await scrapeEvents(year);
      await upsert(`rx:events:${year}`, { year, events });
      stored.push(`rx:events:${year}`);
    } catch (e) {
      const msg = `events: ${e.message}`;
      console.error('[cron-mxgp]', msg);
      errors.push(msg);
    }

    // ── 2. Championship standings per class ───────────────────────────────────
    for (const cls of CLASSES) {
      await sleep(POLITE_DELAY_MS);
      try {
        console.log(`[cron-mxgp] standings ${cls}…`);
        const data = await scrapeStandings(year, cls);
        const key = `rx:standings:${year}:${cls}`;
        await upsert(key, data);
        stored.push(key);
      } catch (e) {
        const msg = `standings/${cls}: ${e.message}`;
        console.error('[cron-mxgp]', msg);
        errors.push(msg);
      }
    }

    // ── 3. Per-event results ──────────────────────────────────────────────────
    // Only scrape events that:
    //   a) have sessions (at least one moto has been run), AND
    //   b) ended within the last 14 days — don't re-scrape old completed results
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const recentEvents = events.filter(ev => {
      if (!Object.values(ev.sessions || {}).some(arr => arr.length > 0)) return false;
      // Include if endDate is unknown (scrape it) or within the 14-day window
      if (!ev.endDate) return true;
      return ev.endDate >= cutoff;
    });

    console.log(`[cron-mxgp] ${recentEvents.length} recent events to sync (of ${events.length} total)`);

    for (const ev of recentEvents) {
      // Class-level overall results (shows moto1/moto2 scores per rider)
      for (const cls of CLASSES) {
        if (!ev.sessions[cls]) continue; // class not present at this event
        await sleep(POLITE_DELAY_MS);
        try {
          console.log(`[cron-mxgp] overall ${ev.slug}/${cls}…`);
          const data = await scrapeOverall(year, ev.slug, cls);
          const key = `rx:overall:${year}:${ev.slug}:${cls}`;
          await upsert(key, data);
          stored.push(key);
        } catch (e) {
          const msg = `overall/${ev.slug}/${cls}: ${e.message}`;
          console.error('[cron-mxgp]', msg);
          errors.push(msg);
        }

        // Individual session results
        for (const session of (ev.sessions[cls] || [])) {
          await sleep(POLITE_DELAY_MS);
          try {
            console.log(`[cron-mxgp] session ${ev.slug}/${cls}/${session}…`);
            const data = await scrapeSession(year, ev.slug, cls, session);
            const key = `rx:session:${year}:${ev.slug}:${cls}:${session}`;
            await upsert(key, data);
            stored.push(key);
          } catch (e) {
            const msg = `session/${ev.slug}/${cls}/${session}: ${e.message}`;
            console.error('[cron-mxgp]', msg);
            errors.push(msg);
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      year,
      stored: stored.length,
      errors: errors.length,
      errorList: errors,
      keys: stored,
    });
  } catch (e) {
    console.error('[cron-mxgp] fatal:', e);
    return res.status(500).json({ error: e.message });
  }
}
