-- Migration: add sent_fb_posts table for Facebook auto-posting dedup
-- Run this in the Supabase SQL editor before deploying the Facebook cron integration.

create table if not exists sent_fb_posts (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  content_type text,
  feed_name text,
  title text,
  fb_post_id text,
  posted_at timestamptz default now()
);

create unique index if not exists sent_fb_posts_content_id_feed_name_idx
  on sent_fb_posts (content_id, feed_name);
