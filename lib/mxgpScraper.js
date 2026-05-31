// lib/mxgpScraper.js
// Shared utilities for /api/mxgp/* endpoints.
//
// results.mxgp.com is a legacy ASP.NET WebForms site that renders all data
// as HTML tables inside reslists.aspx. Data is selected via server-side
// dropdown postbacks (ASP.NET __doPostBack pattern). Flow for any fetch:
//
//   1. GET  reslists.aspx  →  extract __VIEWSTATE tokens + current dropdown values
//   2. POST reslists.aspx  →  change SelectEvent (locks in race list for that event)
//   3. POST reslists.aspx  →  change SelectRace / SelectResult  →  parse results
//
// For events list and standings, step 2 may be skipped.

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESLISTS_URL = 'https://results.mxgp.com/reslists.aspx';

// Championship (SelectCShip) and class (SelectClass) IDs as they appear in
// the reslists.aspx dropdowns. EMX classes are under cship=6 but their
// exact SelectClass IDs depend on the live dropdown — discovered at runtime.
export const CLASS_CONFIG = {
  mxgp:  { cship: '1', classId: '9', label: 'MXGP' },
  mx1:   { cship: '1', classId: '9', label: 'MXGP' },   // legacy alias
  mx2:   { cship: '1', classId: '7', label: 'MX2' },
  wmx:   { cship: '19', classId: null, label: 'WMX' },   // classId discovered at runtime
  emx:   { cship: '6',  classId: null, label: 'EMX' },   // classId discovered at runtime
  emx250:{ cship: '6',  classId: null, label: 'EMX250' },
  emx125:{ cship: '6',  classId: null, label: 'EMX125' },
};

export const CSHIP_LABELS = {
  '1': 'FIM Motocross World Championship',
  '6': 'Motocross European Championship',
  '19': 'FIM Women\'s Motocross World Championship',
  '14': 'FIM Snowcross World Championship',
};

// SelectResult values
export const RESULT_TYPE = {
  classification: '1',
  lapChart: '2',
  analysis: '3',
  standings: '5',
};

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------

const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { cache.delete(key); return null; }
  return entry.data;
}

export function setCache(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// MXGP races happen Saturday+Sunday UTC
export function isRaceDay() {
  const d = new Date().getUTCDay();
  return d === 0 || d === 6;
}

export function liveMode(req) {
  return req.query?.live === 'true' || req.query?.live === '1' || isRaceDay();
}

// ---------------------------------------------------------------------------
// CORS
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
  return (cls || 'mxgp').toLowerCase().replace(/[-_\s]/g, '');
}

export function getClassConfig(cls) {
  return CLASS_CONFIG[normalizeClass(cls)] || CLASS_CONFIG.mxgp;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function _fetch(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// Step 1: GET the page and return raw HTML
export async function fetchReslistsPage() {
  return _fetch(RESLISTS_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

// Step 2+: POST a form back, returning the updated HTML
export async function postReslists(formState, fields) {
  const body = new URLSearchParams({
    __EVENTTARGET: fields.__EVENTTARGET || '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: formState.__VIEWSTATE,
    __VIEWSTATEGENERATOR: formState.__VIEWSTATEGENERATOR,
    __EVENTVALIDATION: formState.__EVENTVALIDATION,
    SelectYear: fields.SelectYear || '2026',
    SelectCShip: fields.SelectCShip || '1',
    SelectClass: fields.SelectClass || '9',
    SelectEvent: fields.SelectEvent || '',
    SelectRace: fields.SelectRace || '',
    SelectResult: fields.SelectResult || '1',
  });

  return _fetch(RESLISTS_URL, {
    method: 'POST',
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
}

// ---------------------------------------------------------------------------
// ASP.NET form state extraction
// ---------------------------------------------------------------------------

export function extractFormState(html) {
  const vs  = html.match(/name="__VIEWSTATE"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  const vsg = html.match(/name="__VIEWSTATEGENERATOR"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  const ev  = html.match(/name="__EVENTVALIDATION"\s+id="[^"]+"\s+value="([^"]*)"/) ?.[1] ?? '';
  return { __VIEWSTATE: vs, __VIEWSTATEGENERATOR: vsg, __EVENTVALIDATION: ev };
}

// ---------------------------------------------------------------------------
// Dropdown option extraction
// ---------------------------------------------------------------------------

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

// Pull all current dropdown values from a rendered page
export function extractCurrentSelections(html) {
  const sel = (name) => {
    const opts = extractSelectOptions(html, name);
    return opts.find((o) => o.selected)?.value ?? opts[0]?.value ?? '';
  };
  return {
    SelectYear:   sel('SelectYear'),
    SelectCShip:  sel('SelectCShip'),
    SelectClass:  sel('SelectClass'),
    SelectEvent:  sel('SelectEvent'),
    SelectRace:   sel('SelectRace'),
    SelectResult: sel('SelectResult'),
  };
}

// ---------------------------------------------------------------------------
// Race classification parser
// ---------------------------------------------------------------------------
//
// The results page nests tables like:
//   <table width=820> (outer wrapper)
//     <tr> banner image </tr>
//     <tr> title div   </tr>
//     <tr> <table width=100%> ← actual data table
//            <tr> Pos | Nr | Rider | Nat. | Fed. | Bike | Time | laps |
//                  Diff.First | Diff.Prev | Bestlaptime | in lap | Speed </tr>
//            <tr> 1 | 1 | Febvre, Romain | ... </tr>
//            ...
//          </table> </tr>
//   </table>
//
// We find the innermost table whose first row starts with "Pos".

export function parseClassification(html) {
  const $ = cheerio.load(html);

  const titleText = $("div[align='center'], DIV[align='center']").first().text().trim();

  // Find results table: first <table> whose first non-empty row has "Pos" as first cell
  let $data = null;
  $('table').each((_, tbl) => {
    if ($data) return;
    const $t = $(tbl);
    const rows = $t.children('tbody').children('tr');
    const firstTds = rows.first().children('td');
    if (firstTds.first().text().trim() === 'Pos') $data = $t;
  });

  if (!$data) return { title: titleText, results: [] };

  const results = [];
  $data.children('tbody').children('tr').each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).children('td');
    if (tds.length < 7) return;

    const posText = $(tds[0]).text().trim();
    const pos = parseInt(posText);
    if (!Number.isFinite(pos)) return;

    const $rider = $(tds[2]);
    const $link  = $rider.find('a').first();
    const name   = ($link.length ? $link.text() : $rider.text()).trim();
    const riderId = ($link.attr('href') ?? '').match(/[?&]r=(\d+)/)?.[1] ?? null;

    const bike   = $(tds[5]).text().trim();
    const timeRaw = $(tds[6]).text().trim();
    const lapsRaw = $(tds[7]).text().trim();
    const bestLap = $(tds[10]).text().trim();
    const inLap   = $(tds[11]).text().trim();
    const diffFirst = $(tds[8]).text().trim();
    const diffPrev  = $(tds[9]).text().trim();
    const speed     = $(tds[12]).text().trim();

    // Detect DNF/DNS/DSQ
    let status = null;
    const lapsNum = parseInt(lapsRaw);
    if (!Number.isFinite(lapsNum) || lapsNum === 0) status = lapsRaw || 'DNF';

    results.push({
      position: pos,
      number: parseInt($(tds[1]).text().trim()) || $(tds[1]).text().trim(),
      rider: name,
      riderId,
      nationality: $(tds[3]).text().trim(),
      federation: $(tds[4]).text().trim(),
      bike,
      time: timeRaw || null,
      laps: Number.isFinite(lapsNum) ? lapsNum : null,
      diffFirst: diffFirst || null,
      diffPrev:  diffPrev  || null,
      bestLap:   bestLap   || null,
      bestLapNum: parseInt(inLap) || null,
      speed:     parseFloat(speed) || null,
      status,
    });
  });

  return { title: titleText, results };
}

// ---------------------------------------------------------------------------
// Championship standings parser  (SelectResult = '5')
// ---------------------------------------------------------------------------
//
// Standings table columns: Pos | Nr | Rider | Nat. | Bike | Rd1 | Rd2 | … | Total

export function parseStandings(html) {
  const $ = cheerio.load(html);
  const titleText = $("div[align='center'], DIV[align='center']").first().text().trim();

  let $data = null;
  let headers = [];
  $('table').each((_, tbl) => {
    if ($data) return;
    const $t = $(tbl);
    const rows = $t.children('tbody').children('tr');
    const firstTds = rows.first().children('td');
    const firstText = firstTds.first().text().trim();
    if (firstText === 'Pos' || firstText === 'pos') {
      $data = $t;
      firstTds.each((_, td) => headers.push($(td).text().trim()));
    }
  });

  if (!$data) return { title: titleText, headers: [], standings: [] };

  // Identify round columns (everything between Bike col and last Points col)
  // Headers: Pos, Nr, Rider, Nat., Bike, [rounds…], Points
  const fixedLeft = 5;  // Pos Nr Rider Nat. Bike
  const roundHeaders = headers.slice(fixedLeft, headers.length - 1);

  const standings = [];
  $data.children('tbody').children('tr').each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).children('td');
    if (!tds.length) return;

    const pos = parseInt($(tds[0]).text().trim());
    if (!Number.isFinite(pos)) return;

    const roundResults = roundHeaders.map((label, j) => {
      const raw = $(tds[fixedLeft + j]).text().trim();
      const pts = parseInt(raw);
      return { round: j + 1, label, points: Number.isFinite(pts) ? pts : null, raw: raw || null };
    });

    const totalRaw = $(tds[tds.length - 1]).text().trim();
    standings.push({
      position: pos,
      number: parseInt($(tds[1]).text().trim()) || null,
      rider: $(tds[2]).text().trim(),
      nationality: $(tds[3]).text().trim(),
      bike: $(tds[4]).text().trim(),
      totalPoints: parseInt(totalRaw) || null,
      roundResults,
    });
  });

  return { title: titleText, roundHeaders, standings };
}
