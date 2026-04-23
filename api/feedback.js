// api/feedback.js — anonymous user feedback intake.
//
// Spec: see backend feedback/suggest-source spec. Public, anonymous,
// write-only. Honeypot + Supabase-backed per-IP rate limit + email
// notification via Resend.

import {
  applyCors,
  countRecentByIp,
  EMAIL_RE,
  getClientIp,
  hashIp,
  notifyEmail,
  supabase,
} from '../lib/feedbackHelpers.js';

const TABLE = 'feedback';
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const ALLOWED_CATEGORIES = new Set(['bug', 'feature', 'content', 'other']);
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'web']);

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

    // Honeypot — bots fill every field. Return 200 so they can't probe.
    if (typeof body.website === 'string' && body.website.length > 0) {
      console.log('[feedback] honeypot tripped');
      return res.status(200).json({ ok: true });
    }

    const { category, message, email, appVersion, platform, installId } = body;

    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'category',
        message: 'category must be one of bug, feature, content, other',
      });
    }
    if (
      typeof message !== 'string' ||
      message.trim().length < 10 ||
      message.length > 1000
    ) {
      return res.status(400).json({
        ok: false,
        error: 'validation',
        field: 'message',
        message: 'Message must be 10-1000 characters',
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

    const trimmedMessage = message.trim();

    const { error } = await supabase.from(TABLE).insert({
      category,
      message: trimmedMessage,
      email: email?.trim() || null,
      app_version: appVersion || null,
      platform: platform || null,
      install_id: installId || null,
      user_agent: (req.headers['user-agent'] || '').slice(0, 500) || null,
      ip_hash: ipHash,
    });

    if (error) {
      console.error('[feedback] insert error:', error);
      return res.status(500).json({ ok: false, error: 'server' });
    }

    // Await the email send before responding. On Vercel/Lambda the runtime
    // can freeze the function the instant we return, killing any in-flight
    // fetch — fire-and-forget silently loses messages here.
    await notifyEmail({
      subject: `[Feedback] ${category}: ${trimmedMessage.slice(0, 60)}`,
      lines: [
        `Category: ${category}`,
        `Platform: ${platform || '—'}    Version: ${appVersion || '—'}`,
        `Email: ${email || '—'}`,
        `Install: ${installId || '—'}`,
        '---',
        trimmedMessage,
      ],
    }).catch((err) => console.error('[feedback] notifyEmail threw:', err));

    console.log(`[feedback] ✅ ${category} from ${platform || 'unknown'}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[feedback] error:', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
