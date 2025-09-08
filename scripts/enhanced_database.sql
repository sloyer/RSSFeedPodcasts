-- Enhanced database schema for dynamic feed management

i -- Add display fields to all feed tables
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'podcast';
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS clean_slug TEXT GENERATED ALWAYS AS (
  LOWER(REGEXP_REPLACE(COALESCE(display_name, feed_name), '[^a-zA-Z0-9]+', '-', 'g'))
) STORED;

-- Add clean_slug to motocross_feeds (auto-generated from company_name)
ALTER TABLE motocross_feeds ADD COLUMN IF NOT EXISTS clean_slug TEXT GENERATED ALWAYS AS (
  LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]+', '-', 'g'))
) STORED;

-- Add clean_slug to youtube_channels (auto-generated from display_name)
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS clean_slug TEXT GENERATED ALWAYS AS (
  LOWER(REGEXP_REPLACE(COALESCE(display_name, channel_title), '[^a-zA-Z0-9]+', '-', 'g'))
) STORED;

-- Update existing feeds with display names (clean_slug will be auto-generated)
UPDATE rss_feeds SET 
  display_name = 'Steve Matthes Show',
  description = 'The Steve Matthes Show on RacerX',
  category = 'podcast'
WHERE feed_name = 'The Steve Matthes Show';

UPDATE rss_feeds SET 
  display_name = 'PulpMX Show',
  description = 'The PulpMX.com Show',
  category = 'podcast'
WHERE feed_name = 'PulpMX Show';

UPDATE rss_feeds SET 
  display_name = 'Re-Raceables',
  description = 'The Re-Raceables',
  category = 'podcast'
WHERE feed_name = 'The Re-Raceables';

UPDATE rss_feeds SET 
  display_name = 'Moto:60 Show',
  description = 'The Fly Racing Moto:60 Show',
  category = 'podcast'
WHERE feed_name = 'The Fly Racing MOTO:60 Show';

UPDATE rss_feeds SET 
  display_name = 'Vital MX',
  description = 'Vital MX Podcast',
  category = 'podcast'
WHERE feed_name = 'Vital MX';

UPDATE rss_feeds SET 
  display_name = 'Gypsy Tales',
  description = 'Gypsy Tales Podcast',
  category = 'podcast'
WHERE feed_name = 'Gypsy Tales';

UPDATE rss_feeds SET 
  display_name = 'Title 24',
  description = 'Title 24 - Villopoto & Carmichael',
  category = 'podcast'
WHERE feed_name = 'Title 24 - Villopoto & Carmichael';

UPDATE rss_feeds SET 
  display_name = 'Racer X Podcast',
  description = 'Racer X Podcast',
  category = 'podcast'
WHERE feed_name = 'Racer X Podcast';

UPDATE rss_feeds SET 
  display_name = 'Swapmoto Live',
  description = 'Swapmoto Live Podcast',
  category = 'podcast'
WHERE feed_name = 'Swapmoto Live Podcast';

UPDATE rss_feeds SET 
  display_name = 'AC & JB Show',
  description = 'The AC & JB Show',
  category = 'podcast'
WHERE feed_name = 'The AC & JB Show';

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- Can be device ID or actual user ID
  selected_feeds JSONB DEFAULT '[]', -- Array of feed IDs user wants
  selected_article_sources JSONB DEFAULT '[]', -- Array of article source IDs
  selected_youtube_channels JSONB DEFAULT '[]', -- Array of YouTube channel IDs
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create a view for all available content sources
CREATE OR REPLACE VIEW available_content_sources AS
SELECT 
  'podcast' as content_type,
  id,
  feed_name as source_name,
  display_name,
  clean_slug,
  description,
  category,
  image_url,
  is_active,
  NULL as company_name
FROM rss_feeds
WHERE is_active = true

UNION ALL

SELECT 
  'article' as content_type,
  id,
  feed_name as source_name,
  company_name as display_name,
  clean_slug,
  CONCAT('Articles from ', company_name) as description,
  'article' as category,
  NULL as image_url,
  is_active,
  company_name
FROM motocross_feeds
WHERE is_active = true

UNION ALL

SELECT 
  'youtube' as content_type,
  id,
  channel_title as source_name,
  COALESCE(display_name, channel_title) as display_name,
  clean_slug,
  CONCAT('Videos from ', COALESCE(display_name, channel_title)) as description,
  'youtube' as category,
  NULL as image_url,
  is_active,
  NULL as company_name
FROM youtube_channels
WHERE is_active = true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rss_feeds_slug ON rss_feeds(clean_slug);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(is_active);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
