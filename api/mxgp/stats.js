// GET /api/mxgp/stats?year=2026&class=mx1
//
// Computes per-rider stats from cached race results in Supabase:
//   wins, podiums, round-by-round positions + points, averages
//
// Source of truth for total championship points is rx:standings:*
// Round-by-round points are computed from moto positions using FIM scale.
// Wins/podiums are based on overall GP position (not individual moto).

import { createClient } from '@supabase/supabase-js';
import { applyCors, normalizeClass } from '../../lib/mxgpScraper.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// FIM MX points per moto: P1=25, P2=22, P3=20 … P20=1, P21+=0
const MX_PTS = [0, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
function mxPoints(pos) {
  if (!pos || pos < 1 || !Number.isFinite(pos)) return 0;
  return MX_PTS[pos] ?? 0;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const year = String(req.query.year || new Date().getFullYear());
  const cls  = normalizeClass(req.query.class);

  // ── Load events list (round order + metadata) ─────────────────────────────
  const { data: evCache } = await supabase
    .from('mxgp_cache')
    .select('data')
    .eq('key', `rx:events:${year}`)
    .single();

  if (!evCache?.data?.events) {
    return res.status(404).json({ error: 'No events data — run cron first' });
  }

  // Only events that have sessions for this class and include GP races
  const completedRounds = evCache.data.events.filter(ev => {
    const sessions = ev.sessions?.[cls] || [];
    return sessions.some(s => s.includes('grand-prix-race') || s === 'race-1' || s === 'race-2');
  });

  // ── Load standings for authoritative total points ─────────────────────────
  const { data: standingsCache } = await supabase
    .from('mxgp_cache')
    .select('data')
    .eq('key', `rx:standings:${year}:${cls}`)
    .single();

  const standingsMap = {}; // riderSlug/name → { position, points }
  for (const s of standingsCache?.data?.standings ?? []) {
    const k = s.riderSlug || s.rider;
    standingsMap[k] = { standingsPos: s.position, totalPoints: s.points };
  }

  // ── Load overall results for each completed round ─────────────────────────
  const roundKeys = completedRounds.map(ev => `rx:overall:${year}:${ev.slug}:${cls}`);

  const { data: overallRows } = await supabase
    .from('mxgp_cache')
    .select('key, data')
    .in('key', roundKeys);

  const overallBySlug = {};
  for (const row of overallRows ?? []) {
    const slug = row.key.replace(`rx:overall:${year}:`, '').replace(`:${cls}`, '');
    overallBySlug[slug] = row.data?.results ?? [];
  }

  // ── Aggregate per-rider stats ─────────────────────────────────────────────
  const rounds = [];
  const riderMap = {};

  completedRounds.forEach((ev, i) => {
    const roundNum = i + 1;
    rounds.push({
      round:     roundNum,
      slug:      ev.slug,
      name:      ev.name,
      startDate: ev.startDate,
      country:   ev.country,
      venue:     ev.venue,
    });

    const results = overallBySlug[ev.slug] ?? [];
    for (const r of results) {
      const riderKey = r.riderSlug || r.rider;
      if (!riderKey) continue;

      if (!riderMap[riderKey]) {
        riderMap[riderKey] = {
          rider:       r.rider,
          riderSlug:   r.riderSlug || null,
          nationality: r.nationality || null,
          brand:       r.brand || null,
          wins:        0,
          podiums:     0,
          motoWins:    0,
          computedPoints: 0,
          roundsStarted:  0,
          rounds:      [],
        };
      }

      const entry = riderMap[riderKey];
      const pos   = r.position;
      const m1    = r.moto1 ?? null;
      const m2    = r.moto2 ?? null;
      const roundPts = mxPoints(m1) + mxPoints(m2);

      if (pos === 1)  entry.wins++;
      if (pos <= 3)   entry.podiums++;
      if (m1 === 1 || m2 === 1) entry.motoWins++;
      entry.computedPoints += roundPts;
      entry.roundsStarted++;

      entry.brand = entry.brand || r.brand || null;

      entry.rounds.push({
        round:      roundNum,
        slug:       ev.slug,
        overallPos: pos,
        moto1:      m1,
        moto2:      m2,
        points:     roundPts,
      });
    }
  });

  // ── Merge standings totals + sort ─────────────────────────────────────────
  const riders = Object.values(riderMap).map(r => {
    const standing = standingsMap[r.riderSlug] ?? standingsMap[r.rider] ?? {};
    return {
      ...r,
      standingsPos:  standing.standingsPos ?? null,
      totalPoints:   standing.totalPoints  ?? r.computedPoints,
      avgPointsPerRound: r.roundsStarted > 0
        ? Math.round((r.computedPoints / r.roundsStarted) * 10) / 10
        : 0,
    };
  });

  // Sort by official standings position; fall back to computed points
  riders.sort((a, b) => {
    if (a.standingsPos && b.standingsPos) return a.standingsPos - b.standingsPos;
    return b.totalPoints - a.totalPoints;
  });

  return res.status(200).json({
    year,
    class: cls,
    roundsCompleted: rounds.length,
    rounds,
    riders,
  });
}
