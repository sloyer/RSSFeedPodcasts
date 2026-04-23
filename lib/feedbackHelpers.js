// lib/feedbackHelpers.js — shared utilities for /api/feedback and /api/suggest-source
//
// Responsibilities:
//   - CORS handling consistent with the rest of the project
//   - Anonymous IP hashing (SHA-256 + server-side salt, first 16 chars)
//   - Rate limiting backed by Supabase (no extra infra required)
//   - Email notification via Resend (HTTP API — no SDK dependency)
//   - Small validation helpers shared between the two endpoints
//
// Notes for future maintainers:
//   - We intentionally do NOT take a hard dependency on Upstash/Vercel KV.
//     Counting rows in the target table by ip_hash keeps the moving parts
//     to a minimum and is plenty for the expected (very low) write volume.
//   - All notification side-effects are fire-and-forget; a failed email
//     should never cause the user-visible request to fail.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Use the service-role key when present so we can write to RLS-locked tables.
// Falls back to the anon key for local development convenience.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function hashIp(ip) {
  // IP_SALT is required in production. In dev we fall back so the server
  // still boots, but the hash is effectively unsalted — log a warning.
  const salt = process.env.IP_SALT;
  if (!salt) {
    console.warn('[feedback] IP_SALT not set — IP hashes are not salted');
  }
  return createHash('sha256')
    .update(ip + (salt || ''))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Count how many rows the given IP has inserted into `table` within the last
 * `windowMs` milliseconds. Used to enforce per-IP rate limits without an
 * external store.
 */
export async function countRecentByIp(table, ipHash, windowMs) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error) {
    // Don't block writes on a metering failure — log and allow through.
    console.error(`[feedback] rate-limit count failed for ${table}:`, error);
    return 0;
  }
  return count || 0;
}

/**
 * Send an email notification via the Resend HTTP API. No-op if RESEND_API_KEY
 * or FEEDBACK_EMAIL_TO is missing so local dev / preview deploys stay quiet.
 */
export async function notifyEmail({ subject, lines }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;
  const from = process.env.FEEDBACK_EMAIL_FROM || 'onboarding@resend.dev';

  if (!apiKey || !to) {
    console.warn(
      `[feedback] email skipped — apiKey:${apiKey ? 'set' : 'MISSING'} to:${to ? 'set' : 'MISSING'} from:${from}`
    );
    return;
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5">${lines
    .map((l) =>
      l.startsWith('---')
        ? '<hr style="border:none;border-top:1px solid #ddd;margin:12px 0">'
        : `<div>${escapeHtml(l)}</div>`
    )
    .join('')}</div>`;

  const text = lines.join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('[feedback] Resend send failed:', response.status, body);
    }
  } catch (err) {
    console.error('[feedback] Resend send threw:', err);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
