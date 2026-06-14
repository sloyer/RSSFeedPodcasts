-- Add logo_url column to motocross_feeds (news sources)
ALTER TABLE motocross_feeds
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
