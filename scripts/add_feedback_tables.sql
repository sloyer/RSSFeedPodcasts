-- scripts/add_feedback_tables.sql
-- Schema for /api/feedback and /api/suggest-source.
-- Run once in the Supabase SQL editor.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug','feature','content','other')),
  message text not null check (length(message) between 10 and 1000),
  email text,
  app_version text,
  platform text check (platform in ('ios','android','web')),
  install_id text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on feedback (created_at desc);

-- Helps the Supabase-backed rate limiter stay fast as the table grows.
create index if not exists feedback_ip_hash_created_at_idx
  on feedback (ip_hash, created_at desc);

create table if not exists source_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('news','podcast','youtube')),
  name text not null check (length(name) between 2 and 120),
  url text not null check (length(url) between 4 and 500),
  notes text check (length(notes) <= 500),
  email text,
  app_version text,
  platform text check (platform in ('ios','android','web')),
  install_id text,
  user_agent text,
  ip_hash text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','duplicate')),
  reviewer_notes text,
  created_at timestamptz not null default now()
);
create index if not exists source_suggestions_status_created_at_idx
  on source_suggestions (status, created_at desc);
create index if not exists source_suggestions_ip_hash_created_at_idx
  on source_suggestions (ip_hash, created_at desc);

-- Duplicate-prevention: only one *pending* suggestion per URL.
-- Once a row is approved/rejected/marked duplicate it no longer blocks
-- future submissions of the same URL.
create unique index if not exists source_suggestions_pending_url_unique
  on source_suggestions (lower(url)) where status = 'pending';

-- Lock down both tables — only the service-role key (used server-side) can
-- read/write. No public policies on purpose.
alter table feedback enable row level security;
alter table source_suggestions enable row level security;
