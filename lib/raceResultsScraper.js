// lib/raceResultsScraper.js
// Shared utilities for /api/race-results/* endpoints.
// Scrapes LiveMX HTML pages, parses results, and serves JSON with in-memory TTL caching.

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------------------------------------------------------------------------
// In-memory TTL cache (per-process; cold starts re-scrape)
// ---------------------------------------------------------------------------

const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Race-day helpers
// ---------------------------------------------------------------------------

// Saturday is race day for SX/SMX. Use UTC-friendly check that also covers
// Friday-evening US time when UTC has rolled to Saturday.
export function isRaceDay() {
  const day = new Date().getUTCDay();
  return day === 6 || day === 0; // Saturday or Sunday UTC (covers all US timezones on race day)
}

export function liveMode(req) {
  return req.query?.live === 'true' || req.query?.live === '1' || isRaceDay();
}

// ---------------------------------------------------------------------------
// LiveMX domain selection
// ---------------------------------------------------------------------------
//
// All three series use the same LiveMX-style HTML platform, just on different
// domains. Same parsers work across the board.
//
//   smx (or sx)     -> https://smx.livemx.com           (Supercross —
//                                                         smx is the legacy
//                                                         alias and stays the
//                                                         default for back-
//                                                         wards compat with
//                                                         the existing app)
//   mx              -> https://results.promotocross.com (Pro Motocross outdoor)
//   smx_playoffs    -> https://results.supermotocross.com (3-round Sept
//                                                          playoffs; events
//                                                          page is filtered to
//                                                          "SMX Playoff …"
//                                                          rows in events.js)

export function liveMxBase(seriesParam) {
  const s = (seriesParam || 'smx').toLowerCase();
  if (s === 'mx') return 'https://results.promotocross.com';
  if (s === 'smx_playoffs' || s === 'playoffs') return 'https://results.supermotocross.com';
  // 'smx' (legacy default) and 'sx' both map to smx.livemx.com (Supercross).
  return 'https://smx.livemx.com';
}

export function normalizeSeries(seriesParam) {
  const s = (seriesParam || 'smx').toLowerCase();
  if (s === 'mx') return 'mx';
  if (s === 'smx_playoffs' || s === 'playoffs') return 'smx_playoffs';
  // 'sx' is just an alias for 'smx' (both -> smx.livemx.com Supercross data).
  return 'smx';
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function fetchHtml(url, { timeoutMs = 12000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });
      clearTimeout(t);
      if (!r.ok) {
        throw new Error(`Upstream ${r.status} for ${url}`);
      }
      return await r.text();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('fetchHtml failed');
}

// ---------------------------------------------------------------------------
// Manufacturer extraction
// ---------------------------------------------------------------------------

const MFG_OVERRIDES = {
  ktm: 'KTM',
  gas: 'GASGAS',
  gasgas: 'GASGAS',
  bmw: 'BMW',
  ktmsx: 'KTM',
  husqvarna: 'Husqvarna',
  yamaha: 'Yamaha',
  honda: 'Honda',
  kawasaki: 'Kawasaki',
  suzuki: 'Suzuki',
  triumph: 'Triumph',
  beta: 'Beta',
  ducati: 'Ducati',
  sherco: 'Sherco'
};

export function manufacturerFromImg(src) {
  if (!src) return null;
  // .../manufacturers/primary/yamaha.png  ->  yamaha
  const m = src.match(/\/([^/]+)\.(png|jpg|jpeg|svg|webp)(?:\?.*)?$/i);
  if (!m) return null;
  const slug = m[1].toLowerCase();
  if (MFG_OVERRIDES[slug]) return MFG_OVERRIDES[slug];
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Strip the LiveMX "##" double-hash CSS quirk:
//   color: ##ffffff; background-color: ##FFFF000  ->  #ffffff / #FFFF000
export function stripDoubleHash(value) {
  if (!value) return value;
  return String(value).replace(/##/g, '#');
}

export function extractColors(styleAttr) {
  const out = { color: null, borderColor: null, backgroundColor: null };
  if (!styleAttr) return out;
  const cleaned = stripDoubleHash(styleAttr);
  const colorM = cleaned.match(/(?:^|[;\s])color\s*:\s*([^;]+)/i);
  const borderM = cleaned.match(/border-color\s*:\s*([^;]+)/i);
  const bgM = cleaned.match(/background-color\s*:\s*([^;]+)/i);
  if (colorM) out.color = colorM[1].trim();
  if (borderM) out.borderColor = borderM[1].trim();
  if (bgM) out.backgroundColor = bgM[1].trim();
  return out;
}

// ---------------------------------------------------------------------------
// Time / position helpers
// ---------------------------------------------------------------------------

// "1:07.436" -> 67.436, "45.719" -> 45.719, ""/null -> null
export function parseLapSeconds(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s || s === '---' || s === '-' || s === '0' || s === '0.000') return null;
  const colon = s.match(/^(\d+):([\d.]+)$/);
  if (colon) {
    return parseFloat(colon[1]) * 60 + parseFloat(colon[2]);
  }
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

// "1st" -> 1, "12th" -> 12, "5" -> 5
export function parsePosition(str) {
  if (str === null || str === undefined) return null;
  const m = String(str).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// racerLaps JS-object extractor
// ---------------------------------------------------------------------------
//
// LiveMX race-result pages embed something like:
//
//   racerLaps[767020] = {
//     'laps': [
//       { 'lapNum': '0', 'pos': '2', 'time': '0', 'pace': '0', 'segments': [] },
//       { 'lapNum': '1', 'pos': '4', 'time': '61.732', 'pace': '16/16:27.718',
//         'segments': [
//           {'segment': '1', 'time': ''},
//           {'segment': '2', 'time': '6.030992'},
//           ...
//         ]
//       }
//     ]
//   };
//
// It's JS, not JSON — single quotes, sometimes trailing commas, occasionally
// unquoted keys. Walk braces to find the block, normalize, parse.

function jsObjectToJson(jsStr) {
  return jsStr
    // single-quoted strings -> double-quoted (handles 'pos': '4' just fine)
    .replace(/'/g, '"')
    // unquoted keys: { lapNum: ... } -> { "lapNum": ... }
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    // strip trailing commas
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}');
}

export function parseRacerLaps(html) {
  const riders = {};
  const re = /racerLaps\s*\[\s*(\d+)\s*\]\s*=\s*\{/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const driverId = m[1];
    const startIdx = m.index + m[0].length - 1; // index of the opening '{'
    let depth = 0;
    let endIdx = -1;
    let inStr = null;
    for (let i = startIdx; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (ch === '\\') {
          i++;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        inStr = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) continue;
    const block = html.substring(startIdx, endIdx + 1);
    let parsed = null;
    try {
      parsed = JSON.parse(jsObjectToJson(block));
    } catch (_) {
      // best-effort fallback: extract individual lap rows
      parsed = { laps: fallbackParseLaps(block) };
    }
    if (parsed && Array.isArray(parsed.laps)) {
      riders[driverId] = parsed.laps.map(normalizeLap);
    }
  }
  return riders;
}

function fallbackParseLaps(block) {
  const laps = [];
  const lapRe = /\{\s*['"]?lapNum['"]?\s*:\s*['"]?(\d+)['"]?\s*,\s*['"]?pos['"]?\s*:\s*['"]?(\d+)['"]?\s*,\s*['"]?time['"]?\s*:\s*['"]?([\d.]+)['"]?(?:[^}]*?['"]?pace['"]?\s*:\s*['"]?([^'",}]*)['"]?)?/g;
  let m;
  while ((m = lapRe.exec(block)) !== null) {
    laps.push({
      lapNum: m[1],
      pos: m[2],
      time: m[3],
      pace: m[4] || '',
      segments: []
    });
  }
  return laps;
}

function normalizeLap(raw) {
  const lap = parseInt(raw.lapNum, 10);
  const pos = parseInt(raw.pos, 10);
  const time = parseLapSeconds(raw.time);
  const segments = Array.isArray(raw.segments)
    ? raw.segments.map((seg) => ({
        segment: parseInt(seg.segment, 10),
        time: parseLapSeconds(seg.time)
      }))
    : [];
  return {
    lap: Number.isFinite(lap) ? lap : null,
    pos: Number.isFinite(pos) ? pos : null,
    time,
    pace: raw.pace || null,
    segments
  };
}

// ---------------------------------------------------------------------------
// driverNames extractor
// ---------------------------------------------------------------------------
//
// Pages typically have something like:
//   driverNames[0] = "ANSTIE, MAX";
//   driverNames[1] = "DEEGAN, HAIDEN";
// or
//   driverNames = ['ANSTIE, MAX', 'DEEGAN, HAIDEN', ...];
//
// We don't actually need driverNames to map racerLaps -> rider; the racerLaps
// keys are LiveMX driver IDs that match the table's `data-driver-id` /
// `data-racer-id` attributes (or the rider number, depending on the page).
// We'll match by table position fallback if direct id lookup fails.

export function parseDriverNames(html) {
  // LiveMX race-result pages emit either:
  //   driverNames[0] = "ANSTIE, MAX";  (rare)
  //   driverNames.push('MAX ANSTIE');  (common — interleaved with racerLaps[ID] blocks)
  //
  // Returns an ordered array of names (insertion order matches racerLaps insertion).
  const names = [];
  const indexed = {};
  const reIdx = /driverNames\s*\[\s*(\d+)\s*\]\s*=\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = reIdx.exec(html)) !== null) {
    indexed[m[1]] = m[2];
  }
  const rePush = /driverNames\.push\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = rePush.exec(html)) !== null) {
    names.push(m[1]);
  }
  // Merge indexed if any
  Object.keys(indexed)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((idx) => {
      if (!names[idx]) names[idx] = indexed[idx];
    });
  return names;
}

// Extract racerLaps preserving insertion order alongside driverNames.push() order.
// Returns [{ driverId, laps }] in the exact order they appear in the HTML —
// LiveMX emits these in the same order as the main results table (P1, P2, ...).
export function parseRacerLapsOrdered(html) {
  const out = [];
  const re = /racerLaps\s*\[\s*(\d+)\s*\]\s*=\s*\{/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const driverId = m[1];
    const startIdx = m.index + m[0].length - 1;
    let depth = 0;
    let endIdx = -1;
    let inStr = null;
    for (let i = startIdx; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx === -1) continue;
    const block = html.substring(startIdx, endIdx + 1);
    let parsed = null;
    try {
      parsed = JSON.parse(jsObjectToJson(block));
    } catch (_) {
      parsed = { laps: fallbackParseLaps(block) };
    }
    if (parsed && Array.isArray(parsed.laps)) {
      out.push({ driverId, laps: parsed.laps.map(normalizeLap) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Session classification
// ---------------------------------------------------------------------------

export function classifySessionType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('main')) return 'main';
  if (n.includes('lcq')) return 'lcq';
  // Pro Motocross uses "Consolation Race" as the last-chance qualifier.
  if (n.includes('consolation')) return 'lcq';
  if (n.includes('semi')) return 'semi';
  if (n.includes('heat')) return 'heat';
  if (n.includes('qualifying') || n.includes('practice') || n.includes('qualifier')) return 'qualifying';
  if (n.includes('combined')) return 'qualifying_combined';
  // Pro Motocross uses "Moto 1" / "Moto 2" instead of "Main" — these are the
  // headline races of the day. Treat them as 'moto'.
  if (/\bmoto\b/.test(n)) return 'moto';
  return 'other';
}

export function classifySessionClass(name) {
  const n = (name || '');
  if (/\b250\b/.test(n)) return '250';
  if (/\b450\b/.test(n)) return '450';
  if (/\bWMX\b/i.test(n)) return 'WMX';
  if (/\bKTM\s*Jr/i.test(n)) return 'KTMJr';
  return null;
}

// ---------------------------------------------------------------------------
// Cheerio entry point
// ---------------------------------------------------------------------------

export function loadHtml(html) {
  return cheerio.load(html);
}

// ---------------------------------------------------------------------------
// Results-table parser (HTML rows on race_result page)
// ---------------------------------------------------------------------------
//
// Expected columns (verified per spec):
//   POS | # | BIKE (img) | RIDER | INTERVAL | TOTAL TIME | HOMETOWN | TEAM
// Some pages render the table twice; take the first instance whose header
// matches the expected layout.

// Pull only top-level headers and rows (avoid nested-table contamination
// where Lap Times / Lap Chart sub-tables live inside the main results table).
export function parseResultsTable($) {
  const tables = $('table');
  let chosen = null;
  let headerMap = null;
  let chosenHeaders = [];

  tables.each((_, tbl) => {
    if (chosen) return;
    const $tbl = $(tbl);

    // Get top-level header row only (children, not deep-find)
    let $hdrRow = $tbl.children('thead').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tbody').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tr').first();
    const headers = $hdrRow.children('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
    if (!headers.length) return;

    const findIdx = (...candidates) => {
      for (const cand of candidates) {
        const idx = headers.findIndex((h) => h === cand || h.includes(cand));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const posIdx = findIdx('pos');
    const numIdx = headers.findIndex((h) => h === '#' || h === 'no' || h === 'number');
    const riderIdx = findIdx('rider', 'name');
    if (posIdx === -1 || numIdx === -1 || riderIdx === -1) return;

    headerMap = {
      pos: posIdx,
      num: numIdx,
      bike: findIdx('bike', 'mfg', 'manuf'),
      rider: riderIdx,
      interval: findIdx('interval', 'gap'),
      bestLap: findIdx('best lap'),
      totalTime: findIdx('total time', 'time'),
      hometown: findIdx('hometown'),
      team: findIdx('team')
    };
    chosen = $tbl;
    chosenHeaders = headers;
  });

  if (!chosen || !headerMap) return [];

  const rows = [];
  // Only top-level rows of the chosen table
  const trs = [];
  chosen.children('tbody').children('tr').each((_, tr) => trs.push(tr));
  if (!trs.length) chosen.children('tr').each((_, tr) => trs.push(tr));

  for (const tr of trs) {
    const $tr = $(tr);
    // Direct-child td count must match header column count (within reason)
    const tds = $tr.children('td');
    if (!tds.length) continue;
    if (tds.length < headerMap.rider + 1) continue;

    const cell = (idx) => (idx >= 0 && idx < tds.length ? $(tds.get(idx)) : null);
    const $bike = cell(headerMap.bike);
    const mfg = $bike ? manufacturerFromImg($bike.find('img').attr('src')) : null;

    const position = parsePosition(cell(headerMap.pos)?.text());
    const number = (cell(headerMap.num)?.text() || '').trim();
    // Rider cell often has a leading <i> icon and may have nested
    // AVG/BEST/IDEAL summary divs and Holeshot/DNF/DNS tags underneath.
    const $rider = cell(headerMap.rider);
    let rider = '';
    let holeshot = false;
    let status = null; // DNF, DNS, etc.
    if ($rider) {
      const flat = $rider.text().replace(/[\t\r]/g, ' ').replace(/ +/g, ' ');
      const lines = flat.split('\n').map((s) => s.trim()).filter(Boolean);
      const namedLine =
        lines.find((l) => !/^(?:AVG|BEST|IDEAL):/i.test(l)) || '';
      let cleaned = namedLine;
      if (/\bHoleshot\b/i.test(cleaned)) {
        holeshot = true;
        cleaned = cleaned.replace(/\bHoleshot\b/i, '').trim();
      }
      const statusM = cleaned.match(/\b(DNF|DNS|DSQ|DQ)\b/i);
      if (statusM) {
        status = statusM[1].toUpperCase();
        cleaned = cleaned.replace(statusM[0], '').trim();
      }
      rider = cleaned.replace(/\s+/g, ' ').trim();
    }

    const interval = headerMap.interval >= 0 ? cleanText(cell(headerMap.interval)?.text()) : null;
    const bestLapText = headerMap.bestLap >= 0 ? cleanText(cell(headerMap.bestLap)?.text()) : null;
    const totalTime = headerMap.totalTime >= 0 ? cleanText(cell(headerMap.totalTime)?.text()) : null;
    const hometown = headerMap.hometown >= 0 ? cleanText(cell(headerMap.hometown)?.text()) : null;
    const team = headerMap.team >= 0 ? cleanText(cell(headerMap.team)?.text()) : null;

    if (position === null && !rider) continue;
    rows.push({
      position,
      number,
      rider,
      manufacturer: mfg,
      interval: interval || null,
      bestLapDisplay: bestLapText || null,
      totalTime: totalTime || null,
      hometown: hometown || null,
      team: team || null,
      holeshot,
      status
    });
  }

  return rows;
}

function cleanText(s) {
  if (s === null || s === undefined) return null;
  return String(s).replace(/\s+/g, ' ').trim() || null;
}

// ---------------------------------------------------------------------------
// Heat-sheet table parser (qualifying)
// ---------------------------------------------------------------------------

export function parseHeatSheetTable($) {
  const tables = $('table');
  let chosen = null;
  let headerMap = null;
  tables.each((_, tbl) => {
    if (chosen) return;
    const $tbl = $(tbl);
    let $hdrRow = $tbl.children('thead').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tbody').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tr').first();
    const headers = $hdrRow.children('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
    if (!headers.length) return;
    const findIdx = (...cands) => {
      for (const c of cands) {
        const idx = headers.findIndex((h) => h === c || h.includes(c));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const posIdx = findIdx('grid', 'pos');
    const numIdx = headers.findIndex((h) => h === '#' || h === 'no' || h === 'number');
    const riderIdx = findIdx('rider', 'name');
    if (posIdx === -1 || numIdx === -1 || riderIdx === -1) return;
    headerMap = {
      pos: posIdx,
      num: numIdx,
      rider: riderIdx,
      hometown: findIdx('hometown'),
      team: findIdx('team'),
      bike: findIdx('bike', 'mfg', 'manuf')
    };
    chosen = $tbl;
  });
  if (!chosen || !headerMap) return [];
  const rows = [];
  const trs = [];
  chosen.children('tbody').children('tr').each((_, tr) => trs.push(tr));
  if (!trs.length) chosen.children('tr').each((_, tr) => trs.push(tr));
  for (const tr of trs) {
    const $tr = $(tr);
    const tds = $tr.children('td');
    if (!tds.length) continue;
    if (tds.length < headerMap.rider + 1) continue;
    const cell = (idx) => (idx >= 0 && idx < tds.length ? $(tds.get(idx)) : null);
    const position = parsePosition(cell(headerMap.pos)?.text());
    const number = (cell(headerMap.num)?.text() || '').trim();
    const $rider = cell(headerMap.rider);
    const rider = $rider ? cleanText($rider.text()) : '';
    const hometown = headerMap.hometown >= 0 ? cleanText(cell(headerMap.hometown)?.text()) : null;
    const team = headerMap.team >= 0 ? cleanText(cell(headerMap.team)?.text()) : null;
    const $bike = headerMap.bike >= 0 ? cell(headerMap.bike) : null;
    const mfg = $bike ? manufacturerFromImg($bike.find('img').attr('src')) : null;
    if (position === null && !rider) continue;
    rows.push({ position, number, rider, manufacturer: mfg, hometown: hometown || null, team: team || null });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Standings parser
// ---------------------------------------------------------------------------

export function parseStandings($) {
  const title =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    $('h3').first().text().trim() ||
    null;

  // Find the standings table: needs rider + points columns. Position column
  // header may be empty on LiveMX standings pages (first column).
  const tables = $('table');
  let chosen = null;
  let headerCells = [];
  tables.each((_, tbl) => {
    if (chosen) return;
    const $tbl = $(tbl);
    let $hdrRow = $tbl.children('thead').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tbody').children('tr').first();
    if (!$hdrRow.length) $hdrRow = $tbl.children('tr').first();
    const ths = $hdrRow.children('th').map((_, th) => $(th)).get();
    if (ths.length < 4) return;
    const headerText = ths.map(($th) => $th.text().trim().toLowerCase());
    const hasRider = headerText.some((h) => h.includes('rider') || h.includes('name'));
    const hasPoints = headerText.some(
      (h) => h === 'points' || h === 'pts' || h === 'total' || h.includes('total')
    );
    if (!hasRider || !hasPoints) return;
    chosen = $tbl;
    headerCells = ths;
  });

  if (!chosen) {
    return { title, rounds: [], standings: [] };
  }

  // Map header columns to roles. Empty-text first column is treated as position.
  const colRoles = headerCells.map(($th, idx) => {
    const txt = $th.text().trim();
    const lower = txt.toLowerCase();
    if (idx === 0 && !txt) return { role: 'position' };
    if (lower === 'pos' || lower.startsWith('position') || lower === 'rank') return { role: 'position' };
    if (lower === '#' || lower === 'no' || lower === 'number') return { role: 'number' };
    if (lower.includes('bike') || lower.includes('manuf') || lower.includes('mfg')) return { role: 'manufacturer' };
    if (lower.includes('rider') || lower.includes('name')) return { role: 'rider' };
    if (lower === 'points' || lower === 'pts' || lower === 'total' || lower.includes('total')) return { role: 'totalPoints' };
    if (lower.includes('adjust')) return { role: 'pointAdjustments' };
    // Round columns look like "1: Anaheim 1" or "Rd 1" or just "1"
    const roundMatch = txt.match(/^(?:Rd\s*)?(\d+)\s*[:.\-]?\s*(.*)$/);
    if (roundMatch) {
      return { role: 'round', round: parseInt(roundMatch[1], 10), name: roundMatch[2].trim() || null };
    }
    return { role: 'unknown', label: txt };
  });

  const rounds = colRoles
    .filter((c) => c.role === 'round')
    .map((c) => ({ round: c.round, name: c.name }));

  const standings = [];
  const trs = [];
  chosen.children('tbody').children('tr').each((_, tr) => trs.push(tr));
  if (!trs.length) chosen.children('tr').each((_, tr) => trs.push(tr));
  for (const tr of trs) {
    const $tr = $(tr);
    if ($tr.children('th').length && !$tr.children('td').length) continue;
    const tds = $tr.children('td');
    if (!tds.length) continue;

    const row = {
      position: null,
      number: null,
      numberStyle: null,
      manufacturer: null,
      rider: null,
      totalPoints: null,
      pointAdjustments: null,
      roundResults: []
    };

    tds.each((idx, td) => {
      const $td = $(td);
      const role = colRoles[idx];
      if (!role) return;
      const text = $td.text().trim();
      switch (role.role) {
        case 'position':
          row.position = parsePosition(text);
          break;
        case 'number': {
          const $num = $td.find('.car_number, .carNumber, div').first();
          row.number = ($num.text() || text).trim();
          const style = $num.attr('style') || $td.attr('style');
          if (style) row.numberStyle = extractColors(style);
          break;
        }
        case 'manufacturer': {
          const src = $td.find('img').attr('src');
          row.manufacturer = manufacturerFromImg(src);
          break;
        }
        case 'rider':
          row.rider = text;
          break;
        case 'totalPoints': {
          const num = parseInt(text.replace(/[^\d-]/g, ''), 10);
          row.totalPoints = Number.isFinite(num) ? num : null;
          break;
        }
        case 'pointAdjustments': {
          const num = parseInt(text.replace(/[^\d-]/g, ''), 10);
          row.pointAdjustments = Number.isFinite(num) ? num : 0;
          break;
        }
        case 'round': {
          // Cell looks like "<b>25</b>1st" or "25 1st" or empty
          const $b = $td.find('b').first();
          const ptsRaw = $b.length ? $b.text().trim() : text.match(/^(\d+)/)?.[1] || null;
          let finishRaw = null;
          if ($b.length) {
            // remainder of the cell after the <b>
            finishRaw = $td.text().replace($b.text(), '').trim() || null;
          } else {
            const m = text.match(/(\d+(?:st|nd|rd|th))/i);
            finishRaw = m ? m[1] : null;
          }
          const ptsNum = ptsRaw !== null ? parseInt(ptsRaw, 10) : null;
          row.roundResults.push({
            round: role.round,
            name: role.name,
            points: Number.isFinite(ptsNum) ? ptsNum : null,
            finish: finishRaw
          });
          break;
        }
        default:
          break;
      }
    });

    if (row.position !== null || row.rider) {
      standings.push(row);
    }
  }

  return { title, rounds, standings };
}
