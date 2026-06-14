// api/canadian-mx/standings.js
// Returns Triple Crown Series championship standings and rider roster.
//
// GET /api/canadian-mx/standings               — all classes + teams
// GET /api/canadian-mx/standings?class=450     — filter to one class
// GET /api/canadian-mx/standings?type=teams    — team standings
// GET /api/canadian-mx/standings?type=riders   — rider standings
//
// Data source: https://triplecrownseries.ca/data/riders.json
// Cached 15 minutes.

import {
  applyCors,
  BASE_URL,
  getCached,
  setCache
} from '../../lib/canadianMxScraper.js';

async function fetchRidersJson() {
  const cached = getCached('canadian_mx_riders');
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/data/riders.json`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MotoApp/1.0)' }
  });
  if (!res.ok) throw new Error(`riders.json returned ${res.status}`);
  const data = await res.json();

  setCache('canadian_mx_riders', data, 15 * 60 * 1000);
  return data;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = await fetchRidersJson();
    const type = req.query.type || 'all';       // all | riders | teams
    const cls  = req.query.class?.toLowerCase(); // 450 | 250 | wmx

    // ---- TEAM standings ----
    const teams = (data.teams || []).map(t => ({
      rank: t.rank,
      team: t.name,
      manufacturer: t.manufacturer,
      points: t.points,
      stagePoints: t.stages || [],
      logo: t.logo ? `${BASE_URL}${t.logo}` : null,
      riders: (t.riders || []).map(r => ({
        number: r.number,
        name: r.name,
        class: r.class,
        age: r.age,
        hometown: r.hometown,
        province: r.province,
        points2025: r.seasonPoints2025 || 0,
        photo: r.photo ? `${BASE_URL}${r.photo}` : null
      }))
    }));

    // ---- RIDER standings — flatten from teams, group by class ----
    const allRiders = teams.flatMap(t =>
      t.riders.map(r => ({ ...r, team: t.team, manufacturer: t.manufacturer }))
    );

    const classes = ['450 Pro', '250 Pro / Am', 'WMX'];
    const ridersByClass = {};
    for (const c of classes) {
      ridersByClass[c] = allRiders
        .filter(r => r.class === c)
        .sort((a, b) => (b.points2025 || 0) - (a.points2025 || 0))
        .map((r, i) => ({ ...r, rank2025: i + 1 }));
    }

    // ---- Past champions (2025) ----
    const stageChampions2025 = data.stageChampions2025 || null;
    const wmx2025 = data.wmx2025 || null;

    // ---- Assemble response ----
    let response = {
      series: 'canadian_mx',
      seriesName: 'Triple Crown Series',
      season: data.season || 2026
    };

    if (type === 'teams') {
      response.teams = teams;
    } else if (type === 'riders') {
      response.riders = cls
        ? ridersByClass[Object.keys(ridersByClass).find(k => k.toLowerCase().includes(cls))] || []
        : ridersByClass;
    } else {
      // All
      if (!cls) {
        response.teams = teams;
        response.riders = ridersByClass;
        response.stageChampions2025 = stageChampions2025;
        response.wmx2025 = wmx2025;
      } else {
        const matchedClass = Object.keys(ridersByClass).find(k => k.toLowerCase().includes(cls));
        response.riders = matchedClass ? ridersByClass[matchedClass] : [];
        response.class = matchedClass || cls;
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).json(response);

  } catch (err) {
    console.error('Canadian MX standings error:', err);
    return res.status(500).json({ error: err.message });
  }
}
