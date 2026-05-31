// lib/mxgpScraper.js
//
// Two data sources:
//
//   LIVE (race weekend) → results.mxgp.com
//     ASP.NET WebForms with VIEWSTATE — the only source with real-time
//     classification results during a race. We only pull result type=1
//     (classification). Standings (type=5) are skipped during live events
//     because the server returns 500 for in-progress events.
//
//   HISTORICAL (post-race) → racerxonline.com
//     Clean server-rendered HTML at slug-based URLs. Used for standings
//     and to back-fill completed events after race weekend ends.

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RX_BASE = 'https://racerxonline.com';

// Class slugs as used in Racer X URLs
export const CLASSES = ['mx1', 'mx2', 'emx250', 'wmx'];

// Human-readable labels
export const CLASS_LABELS = {
  mx1:    'MXGP',
  mx2:    'MX2',
  emx250: 'EMX250',
  wmx:    'WMX',
};

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const _cache = new Map();

export function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { _cache.delete(key); return null; }
  return entry.data;
}

export function setCache(key, data, ttlMs) {
  _cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function isRaceDay() {
  const d = new Date().getUTCDay();
  return d === 0 || d === 6; // Sat or Sun
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------------------------------------------------------------------------
// Class normalisation
// ---------------------------------------------------------------------------

export function normalizeClass(cls) {
  const c = (cls || 'mx1').toLowerCase().replace(/[-_\s]/g, '');
  // Accept legacy aliases
  if (c === 'mxgp' || c === 'mx1' || c === 'gp') return 'mx1';
  if (c === 'mx2') return 'mx2';
  if (c === 'emx250' || c === 'emx') return 'emx250';
  if (c === 'wmx' || c === 'women') return 'wmx';
  return 'mx1';
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function fetchPage(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Scrape events list for a season
// Returns array of { name, slug, url, startDate, endDate, venue, country,
//                    sessions: { mx1:[...], mx2:[...], ... } }
// ---------------------------------------------------------------------------

export async function scrapeEvents(year = 2026) {
  const url = `${RX_BASE}/mxgp/${year}/races`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Parse structured event metadata from JSON-LD
  const eventMeta = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      const parsed = JSON.parse(raw);
      const graph = parsed['@graph'] ?? (Array.isArray(parsed) ? parsed : [parsed]);
      for (const node of graph) {
        if (node['@type'] === 'SportsEvent') {
          // Only accept top-level GP event nodes — URL must end at the event slug
          // e.g. /mxgp/2026/mxgp-of-france (ok) vs /mxgp/2026/mxgp-of-france/mx1 (skip)
          const urlPath = (node.url || '').replace(`${RX_BASE}/mxgp/${year}/`, '');
          const parts = urlPath.split('/').filter(Boolean);
          if (parts.length !== 1) continue;
          const slug = parts[0];
          if (!slug) continue;
          eventMeta[slug] = {
            name: node.name || '',
            startDate: node.startDate || null,
            endDate: node.endDate || null,
            venue: node.location?.name || null,
            country: node.location?.address?.addressCountry || null,
            city: node.location?.address?.addressLocality || null,
          };
        }
      }
    } catch {}
  });

  // Collect session links per event slug → { mx1: [...], mx2: [...], ... }
  const sessionsByEvent = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Pattern: /mxgp/{year}/{event-slug}/{class}/{session-slug}
    const m = href.match(new RegExp(`^/mxgp/${year}/([^/]+)/(mx1|mx2|emx250|wmx|emx125)/([^/?#]+)$`));
    if (!m) return;
    const [, eventSlug, cls, session] = m;
    if (!sessionsByEvent[eventSlug]) sessionsByEvent[eventSlug] = {};
    if (!sessionsByEvent[eventSlug][cls]) sessionsByEvent[eventSlug][cls] = new Set();
    sessionsByEvent[eventSlug][cls].add(session);
  });

  // Also track event slugs from links with just /{event}/{class} (class-level overall)
  const eventSlugs = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(new RegExp(`^/mxgp/${year}/([^/]+)/(mx1|mx2|emx250|wmx|emx125)$`));
    if (m) eventSlugs.add(m[1]);
  });
  // Also from eventMeta
  for (const s of Object.keys(eventMeta)) eventSlugs.add(s);

  const events = [];
  for (const slug of eventSlugs) {
    if (!slug || slug === 'points') continue;
    const meta = eventMeta[slug] || {};
    const sessions = {};
    for (const [cls, set] of Object.entries(sessionsByEvent[slug] || {})) {
      sessions[cls] = Array.from(set).sort();
    }
    events.push({
      slug,
      url: `${RX_BASE}/mxgp/${year}/${slug}`,
      name: meta.name || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      startDate: meta.startDate || null,
      endDate: meta.endDate || null,
      venue: meta.venue || null,
      city: meta.city || null,
      country: meta.country || null,
      sessions,
    });
  }

  // Sort by startDate ascending (null dates go to end)
  events.sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate < b.startDate ? -1 : 1;
  });

  return events;
}

// ---------------------------------------------------------------------------
// Parse a results table → array of rider result rows
// Used for both individual moto and class overall pages.
// ---------------------------------------------------------------------------

function parseResultsTable($) {
  const results = [];

  // Find the table containing rider headshots
  let $table = null;
  $('table').each((_, tbl) => {
    if ($table) return;
    if ($(tbl).find('.contains_headshot').length > 0) $table = $(tbl);
  });
  if (!$table) return results;

  $table.find('tr').each((rowIdx, tr) => {
    const $tds = $(tr).find('td');
    if ($tds.length < 2) return;

    // Position is first td (numeric)
    const pos = parseInt($tds.eq(0).text().trim());
    if (!Number.isFinite(pos)) return;

    // Rider name — inside .contains_headshot td
    const $riderCell = $(tr).find('td.contains_headshot');
    const $nameLink = $riderCell.find('a.block').first();
    const riderName = ($nameLink.length ? $nameLink.text() : $riderCell.text()).trim();
    const riderSlug = ($nameLink.attr('href') || '').replace('/rider/', '').split('/')[0] || null;

    // Nationality flag title
    const nationality = $(tr).find('img.event_flag').attr('title') || null;

    // Remaining cells: varies by page type
    // Moto result: time, gap, [?], [flag], brand
    // Overall:     moto scores (e.g. "2 - 1"), [flag], brand
    const extraCells = [];
    $tds.each((i, td) => {
      if (i === 0) return; // position
      const $td = $(td);
      if ($td.hasClass('contains_headshot')) return;
      if ($td.find('img.event_flag').length) return;
      const text = $td.text().replace(/&nbsp;/g, ' ').trim();
      if (text) extraCells.push(text);
    });

    // Try to find brand (last non-numeric, non-time cell)
    const brand = extraCells.filter(t => /^[A-Z][a-z]/.test(t)).pop() || null;

    // Detect if this is a moto result (has times) or overall (has moto scores like "2 - 1")
    const timeCell = extraCells.find(t => /\d+:\d{2}\.\d{3}/.test(t));
    const gapCell = extraCells.find(t => /^\d+\.\d{3}$/.test(t));
    const motoScoreCell = extraCells.find(t => /\d+\s*[-–]\s*\d+/.test(t));

    const row = {
      position: pos,
      rider: riderName,
      riderSlug,
      nationality,
      brand,
    };

    if (timeCell) {
      row.time = timeCell;
      row.gap = gapCell || null;
    }
    if (motoScoreCell) {
      const parts = motoScoreCell.split(/\s*[-–]\s*/);
      row.moto1 = parseInt(parts[0]) || null;
      row.moto2 = parseInt(parts[1]) || null;
    }

    results.push(row);
  });

  return results;
}

// ---------------------------------------------------------------------------
// Scrape class overall results for an event (pos, rider, moto1, moto2, brand)
// url: /mxgp/{year}/{event-slug}/{cls}
// ---------------------------------------------------------------------------

export async function scrapeOverall(year, eventSlug, cls) {
  const url = `${RX_BASE}/mxgp/${year}/${eventSlug}/${cls}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $('h1, .page-title, .section-title').first().text().trim() ||
                `${year} ${CLASS_LABELS[cls] || cls} - ${eventSlug}`;

  return {
    url,
    title,
    results: parseResultsTable($),
  };
}

// ---------------------------------------------------------------------------
// Scrape individual session results (pos, rider, time, gap, brand)
// url: /mxgp/{year}/{event-slug}/{cls}/{session-slug}
// ---------------------------------------------------------------------------

export async function scrapeSession(year, eventSlug, cls, sessionSlug) {
  const url = `${RX_BASE}/mxgp/${year}/${eventSlug}/${cls}/${sessionSlug}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $('h1, .page-title, .section-title').first().text().trim() ||
                `${year} ${CLASS_LABELS[cls] || cls} - ${sessionSlug}`;

  return {
    url,
    title,
    results: parseResultsTable($),
  };
}

// ---------------------------------------------------------------------------
// Scrape championship standings
// url: /mxgp/{year}/points/{cls}
// Returns { url, title, standings: [{ position, rider, riderSlug, nationality, points }] }
// ---------------------------------------------------------------------------

export async function scrapeStandings(year, cls) {
  const url = `${RX_BASE}/mxgp/${year}/points/${cls}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $('h1, .page-title, .section-title').first().text().trim() ||
                `${year} ${CLASS_LABELS[cls] || cls} Championship Standings`;

  const standings = [];
  let $table = null;
  $('table').each((_, tbl) => {
    if ($table) return;
    if ($(tbl).find('.contains_headshot').length > 0) $table = $(tbl);
  });

  if ($table) {
    $table.find('tr').each((_, tr) => {
      const $tds = $(tr).find('td');
      if ($tds.length < 3) return;
      const pos = parseInt($tds.eq(0).text().trim());
      if (!Number.isFinite(pos)) return;

      const $riderCell = $(tr).find('td.contains_headshot');
      const $nameLink = $riderCell.find('a.block').first();
      const riderName = ($nameLink.length ? $nameLink.text() : $riderCell.text()).trim();
      const riderSlug = ($nameLink.attr('href') || '').replace('/rider/', '').split('/')[0] || null;
      const nationality = $(tr).find('img.event_flag').attr('title') || null;

      // Points — last <td> with a number
      let points = null;
      $tds.each((_, td) => {
        const v = parseInt($(td).text().trim());
        if (Number.isFinite(v) && v > 0) points = v;
      });

      standings.push({ position: pos, rider: riderName, riderSlug, nationality, points });
    });
  }

  return { url, title, standings };
}

// ============================================================================
// results.mxgp.com — LIVE race weekend scraping
// ============================================================================

export const RESLISTS_URL = 'https://results.mxgp.com/reslists.aspx';

// Championship and class IDs used in the MXGP site dropdowns
export const LIVE_CLASSES = [
  { cls: 'mx1', cship: '1', classId: '9', label: 'MXGP' },
  { cls: 'mx2', cship: '1', classId: '7', label: 'MX2'  },
];

// Map the MXGP site race label to a Racer X-style session slug
export function raceNameToSlug(label = '') {
  const n = label.toLowerCase().trim();
  if (/grand.?prix.?race.?1/i.test(n)) return 'grand-prix-race-1';
  if (/grand.?prix.?race.?2/i.test(n)) return 'grand-prix-race-2';
  if (/qualif/i.test(n))               return 'qualifying-race';
  if (/warm.?up/i.test(n))             return 'warmup';
  if (/race.?1/i.test(n))              return 'race-1';
  if (/race.?2/i.test(n))              return 'race-2';
  return n.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET the live results page and return raw HTML
export async function fetchReslistsPage() {
  return fetchPage(RESLISTS_URL, 12000);
}

// POST a form back to trigger a dropdown change, returning updated HTML
export async function postReslists(formState, fields) {
  const body = new URLSearchParams({
    __EVENTTARGET:        fields.__EVENTTARGET || '',
    __EVENTARGUMENT:      '',
    __LASTFOCUS:          '',
    __VIEWSTATE:          formState.__VIEWSTATE,
    __VIEWSTATEGENERATOR: formState.__VIEWSTATEGENERATOR,
    __EVENTVALIDATION:    formState.__EVENTVALIDATION,
    SelectYear:           fields.SelectYear   || '2026',
    SelectCShip:          fields.SelectCShip  || '1',
    SelectClass:          fields.SelectClass  || '9',
    SelectEvent:          fields.SelectEvent  || '',
    SelectRace:           fields.SelectRace   || '',
    SelectResult:         fields.SelectResult || '1',
  });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(RESLISTS_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: RESLISTS_URL,
        Origin: 'https://results.mxgp.com',
      },
      body: body.toString(),
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status} from MXGP site`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// Extract ASP.NET hidden form tokens from HTML
export function extractFormState(html) {
  const vs  = html.match(/name="__VIEWSTATE"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  const vsg = html.match(/name="__VIEWSTATEGENERATOR"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  const ev  = html.match(/name="__EVENTVALIDATION"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  return { __VIEWSTATE: vs, __VIEWSTATEGENERATOR: vsg, __EVENTVALIDATION: ev };
}

// Extract all <option> values from a named <select>
export function extractSelectOptions(html, selectName) {
  const $ = cheerio.load(html);
  const opts = [];
  $(`select[name="${selectName}"] option`).each((_, el) => {
    const $el = $(el);
    opts.push({
      value: $el.attr('value') || '',
      label: $el.text().trim(),
      selected: $el.is('[selected]'),
    });
  });
  return opts;
}

// Parse classification table from results.mxgp.com HTML
// Returns { title, results: [{ position, number, rider, nationality, bike, time, laps, gap, status }] }
export function parseClassification(html) {
  const $ = cheerio.load(html);
  const title = $("div[align='center'], DIV[align='center']").first().text().trim();

  let $data = null;
  $('table').each((_, tbl) => {
    if ($data) return;
    const $t = $(tbl);
    const firstTd = $t.children('tbody').children('tr').first().children('td').first().text().trim();
    if (firstTd === 'Pos') $data = $t;
  });

  if (!$data) return { title, results: [] };

  const results = [];
  $data.children('tbody').children('tr').each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).children('td');
    if (tds.length < 7) return;

    const pos = parseInt($(tds[0]).text().trim());
    if (!Number.isFinite(pos)) return;

    const $riderCell = $(tds[2]);
    const $link = $riderCell.find('a').first();
    const rider = ($link.length ? $link.text() : $riderCell.text()).trim();

    const lapsRaw = $(tds[7]).text().trim();
    const lapsNum = parseInt(lapsRaw);
    const status  = (!Number.isFinite(lapsNum) || lapsNum === 0) ? (lapsRaw || 'DNF') : null;

    results.push({
      position:    pos,
      number:      parseInt($(tds[1]).text().trim()) || null,
      rider,
      nationality: $(tds[3]).text().trim() || null,
      bike:        $(tds[5]).text().trim() || null,
      time:        $(tds[6]).text().trim() || null,
      laps:        Number.isFinite(lapsNum) ? lapsNum : null,
      gap:         $(tds[8]).text().trim() || null,
      status,
    });
  });

  return { title, results };
}
