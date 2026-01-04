-- Fix duplicate push notifications
-- Run this in Supabase SQL Editor

-- 1. First, remove any existing duplicate rows (keep the oldest one)
DELETE FROM sent_notifications a
USING sent_notifications b
WHERE a.id > b.id
  AND a.content_id = b.content_id
  AND a.feed_name = b.feed_name;

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE sent_notifications 
ADD CONSTRAINT sent_notifications_content_feed_unique 
UNIQUE (content_id, feed_name);

-- 3. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sent_notifications_content_feed 
ON sent_notifications(content_id, feed_name);

