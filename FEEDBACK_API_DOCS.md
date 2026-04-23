# Feedback & Suggest-a-Source API

Two public, anonymous, write-only endpoints used by the mobile app and web
client to collect user feedback and source suggestions.

- `POST /api/feedback`
- `POST /api/suggest-source`

Production base URL: `https://rss-feed-podcasts.vercel.app`

## One-time setup

### 1. Create the tables

Run [`scripts/add_feedback_tables.sql`](./scripts/add_feedback_tables.sql)
in the Supabase SQL editor. It creates `feedback` and `source_suggestions`,
adds the supporting indexes, and turns on RLS so only the service role can
read/write them.

### 2. Add environment variables (Vercel)

| Variable                      | Required | Notes |
| ----------------------------- | -------- | ----- |
| `SUPABASE_URL`                | yes      | Already configured. |
| `SUPABASE_SERVICE_ROLE_KEY`   | yes      | New. Server-only — never ship to the client. Falls back to `SUPABASE_ANON_KEY` only for local dev convenience. |
| `IP_SALT`                     | yes      | Random 32-byte hex used to salt IP hashes. Generate with `openssl rand -hex 32`. |
| `RESEND_API_KEY`              | optional | Enables email notifications. Without it, writes still succeed silently. |
| `FEEDBACK_EMAIL_TO`           | optional | Inbox to notify, e.g. `you@yourdomain.com`. Required to actually send mail. |
| `FEEDBACK_EMAIL_FROM`         | optional | Verified sender. Defaults to Resend's sandbox address `onboarding@resend.dev`. |

> Rate limiting uses the `feedback` / `source_suggestions` tables themselves
> (counts rows by `ip_hash` in the last hour). No Upstash/KV setup required.

## `POST /api/feedback`

### Request

```json
{
  "category": "bug | feature | content | other",
  "message": "string, 10-1000 chars",
  "email": "optional valid email",
  "appVersion": "1.4.2",
  "platform": "ios | android | web",
  "installId": "uuid generated client-side",
  "website": ""
}
```

`website` is a honeypot — clients always send `""`. Bots fill it; we silently
return 200 and discard the row.

### Responses

- `200 { "ok": true }` — success (also returned on honeypot trips)
- `400 { "ok": false, "error": "validation", "field": "...", "message": "..." }`
- `429 { "ok": false, "error": "rate_limit", "retryAfterSeconds": N }` — 5/hr per IP
- `500 { "ok": false, "error": "server" }`

## `POST /api/suggest-source`

### Request

```json
{
  "sourceType": "news | podcast | youtube",
  "name": "string, 2-120 chars",
  "url": "string, 4-500 chars (URL or @handle for YouTube)",
  "notes": "optional, max 500 chars",
  "email": "optional valid email",
  "appVersion": "1.4.2",
  "platform": "ios | android | web",
  "installId": "uuid",
  "website": ""
}
```

YouTube handles like `@somechannel` are auto-normalized to
`https://youtube.com/@somechannel` so duplicate detection works.

### Responses

- `200 { "ok": true }`
- `400` — same shape as feedback
- `409 { "ok": false, "error": "duplicate", "message": "Already submitted, thanks!" }` — URL already pending review
- `429 { "ok": false, "error": "rate_limit", "retryAfterSeconds": N }` — 3/hr per IP (tighter than feedback)
- `500 { "ok": false, "error": "server" }`

## Quick test

```bash
# Should succeed
curl -X POST https://rss-feed-podcasts.vercel.app/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"bug","message":"Notifications fire twice on iOS","platform":"ios","appVersion":"1.4.2","installId":"test-1","website":""}'

# Should 400 (message too short)
curl -X POST https://rss-feed-podcasts.vercel.app/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"bug","message":"too short","website":""}'

# Should 200 silently (honeypot)
curl -X POST https://rss-feed-podcasts.vercel.app/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"bug","message":"valid message here","website":"http://spam.com"}'

# Suggest a source
curl -X POST https://rss-feed-podcasts.vercel.app/api/suggest-source \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"youtube","name":"Some Channel","url":"@somechannel","platform":"ios","appVersion":"1.4.2","installId":"test-1","website":""}'

# Run it twice → second call returns 409 duplicate
```

## Reviewing submissions

Anything submitted lands in Supabase. Quick queries:

```sql
-- Latest feedback
select created_at, category, platform, app_version, email, message
from feedback
order by created_at desc
limit 50;

-- Pending source suggestions
select created_at, source_type, name, url, notes, email
from source_suggestions
where status = 'pending'
order by created_at desc;

-- Approve / reject
update source_suggestions
set status = 'approved', reviewer_notes = 'Added to rss_feeds'
where id = '...';
```

Email notifications (via Resend) are best-effort. If `RESEND_API_KEY` or
`FEEDBACK_EMAIL_TO` is missing, the endpoints still record submissions — you
just won't get the inbox ping.
