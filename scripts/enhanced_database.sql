-- Enhanced database schema for dynamic feed management

-- Add display fields to all feed tables
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'podcast';
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS clean_slug TEXT;

-- Add clean_slug to motocross_feeds
ALTER TABLE motocross_feeds ADD COLUMN IF NOT EXISTS clean_slug TEXT;
ALTER TABLE motocross_feeds ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add clean_slug to youtube_channels  
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS clean_slug TEXT;

-- Update existing feeds with display names and slugs
UPDATE rss_feeds SET 
  display_name = 'Steve Matthes Show',
  clean_slug = 'steve-matthes',
  description = 'The Steve Matthes Show on RacerX',
  category = 'podcast'
WHERE feed_name = 'The Steve Matthes Show';

UPDATE rss_feeds SET 
  display_name = 'PulpMX Show',
  clean_slug = 'pulpmx-show',
  description = 'The PulpMX.com Show',
  category = 'podcast'
WHERE feed_name = 'PulpMX Show';

UPDATE rss_feeds SET 
  display_name = 'Re-Raceables',
  clean_slug = 're-raceables',
  description = 'The Re-Raceables',
  category = 'podcast'
WHERE feed_name = 'The Re-Raceables';

UPDATE rss_feeds SET 
  display_name = 'Moto:60 Show',
  clean_slug = 'moto-60',
  description = 'The Fly Racing Moto:60 Show',
  category = 'podcast'
WHERE feed_name = 'The Fly Racing MOTO:60 Show';

UPDATE rss_feeds SET 
  display_name = 'Vital MX',
  clean_slug = 'vital-mx',
  description = 'Vital MX Podcast',
  category = 'podcast'
WHERE feed_name = 'Vital MX';

UPDATE rss_feeds SET 
  display_name = 'Gypsy Tales',
  clean_slug = 'gypsy-tales',
  description = 'Gypsy Tales Podcast',
  category = 'podcast'
WHERE feed_name = 'Gypsy Tales';

-- Add other feeds
UPDATE rss_feeds SET 
  display_name = 'Title 24',
  clean_slug = 'title-24',
  description = 'Title 24 - Villopoto & Carmichael',
  category = 'podcast'
WHERE feed_name = 'Title 24 - Villopoto & Carmichael';

UPDATE rss_feeds SET 
  display_name = 'Racer X Podcast',
  clean_slug = 'racer-x',
  description = 'Racer X Podcast',
  category = 'podcast'
WHERE feed_name = 'Racer X Podcast';

UPDATE rss_feeds SET 
  display_name = 'Swapmoto Live',
  clean_slug = 'swapmoto-live',
  description = 'Swapmoto Live Podcast',
  category = 'podcast'
WHERE feed_name = 'Swapmoto Live Podcast';

UPDATE rss_feeds SET 
  display_name = 'AC & JB Show',
  clean_slug = 'ac-jb-show',
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
  LOWER(REPLACE(company_name, ' ', '-')) as clean_slug,
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
  display_name,
  LOWER(REPLACE(display_name, ' ', '-')) as clean_slug,
  CONCAT('Videos from ', display_name) as description,
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
