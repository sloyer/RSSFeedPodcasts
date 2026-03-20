-- Add quoted_tweet JSONB column to tweets table
-- Stores expanded quoted tweet data fetched from Twitter API v2

ALTER TABLE tweets ADD COLUMN IF NOT EXISTS quoted_tweet JSONB;
