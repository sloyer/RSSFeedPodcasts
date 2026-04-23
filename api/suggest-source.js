// api/suggest-source.js — anonymous "suggest a source" intake.
//
// Spec: see backend feedback/suggest-source spec. Tighter rate limit than
// /api/feedback (3/hr instead of 5/hr) since suggestions are more spammable.
// Duplicate URLs already pending review return 409 thanks to the partial
// unique index `source_suggestions(lower(url)) where status='pending'`.

import {
  applyCors,
  countRecentByIp,
  EMAIL_RE,
  getClientIp,
  hashIp,
  notifyEmail,
  supabase,
} from '../lib/feedbackHelpers.js';

const TABLE = 'source_suggestions';
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const ALLOWED_TYPES = new Set(['news', 'podcast', 'youtube']);
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'web']);

// Accept both full URLs and bare @handles for YouTube; normalize handles to a
// canonical https URL so the duplicate index actually catches them.
function normalizeUrl(sourceType, raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (sourceType === 'youtube' && /^@[\w.-]+$/.test(trimmed)) {
    return `https://youtube.com/${trimmed}`;
  }
  try {
    const u = new URL(trimmed);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = req.body || {};

    if (typeof body.website === 'string' && body.website.length > 0) {
      console.log('[suggest-source] honeypot tripped');
      return res.status(200).json({ ok: true });
    }

    const { sourceType, name, url, notes, email, appVersion, platform, installId } = body;

    if (!ALLOWED_TYPES.has(sourceType)) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'sourceType',
        message: 'sourceType must be one of news, podcast, youtube',
      });
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'name',
        message: 'Name must be 2-120 characters',
      });
    }
    const normalizedUrl = normalizeUrl(sourceType, url);
    if (!normalizedUrl || normalizedUrl.length < 4 || normalizedUrl.length > 500) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'url',
        message: 'Invalid URL',
      });
    }
    if (notes != null && (typeof notes !== 'string' || notes.length > 500)) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'notes',
        message: 'Notes must be ≤ 500 characters',
      });
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'email',
        message: 'Invalid email address',
      });
    }
    if (platform && !ALLOWED_PLATFORMS.has(platform)) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'platform',
        message: 'platform must be one of ios, android, web',
      });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const recent = await countRecentByIp(TABLE, ipHash, RATE_WINDOW_MS);
    if (recent >= RATE_LIMIT) {
      return res.status(429).json({
        ok: false,
        error: 'rate_limit',
        retryAfterSeconds: Math.ceil(RATE_WINDOW_MS / 1000),
      });
    }

    const trimmedName = name.trim();
    const trimmedNotes = notes?.trim() || null;

    const { error } = await supabase.from(TABLE).insert({
      source_type: sourceType,
      name: trimmedName,
      url: normalizedUrl,
      notes: trimmedNotes,
      email: email?.trim() || null,
      app_version: appVersion || null,
      platform: platform || null,
      install_id: installId || null,
      user_agent: (req.headers['user-agent'] || '').slice(0, 500) || null,
      ip_hash: ipHash,
    });

    if (error) {
      // 23505 = unique violation. The partial index on lower(url) where
      // status='pending' surfaces duplicate pending suggestions here.
      if (error.code === '23505') {
        return res.status(409).json({
          ok: false,
          error: 'duplicate',
          message: 'Already submitted, thanks!',
        });
      }
      console.error('[suggest-source] insert error:', error);
      return res.status(500).json({ ok: false, error: 'server' });
    }

    notifyEmail({
      subject: `[Suggest] ${sourceType}: ${trimmedName.slice(0, 60)}`,
      lines: [
        `Type: ${sourceType}`,
        `Name: ${trimmedName}`,
        `URL: ${normalizedUrl}`,
        `Platform: ${platform || '—'}    Version: ${appVersion || '—'}`,
        `Email: ${email || '—'}`,
        `Install: ${installId || '—'}`,
        ...(trimmedNotes ? ['---', `Notes: ${trimmedNotes}`] : []),
      ],
    }).catch(() => {});

    console.log(`[suggest-source] ✅ ${sourceType}: ${trimmedName}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[suggest-source] error:', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
