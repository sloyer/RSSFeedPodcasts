-- Create podcasts table
CREATE TABLE IF NOT EXISTS podcasts (
  id SERIAL PRIMARY KEY,
  feed_url TEXT NOT NULL,
  podcast_name TEXT NOT NULL,
  podcast_title TEXT NOT NULL,
  podcast_date TIMESTAMP NOT NULL,
  podcast_description TEXT,
  podcast_image TEXT,
  guid TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_podcast_date ON podcasts(podcast_date DESC);
CREATE INDEX idx_podcast_name ON podcasts(podcast_name);
CREATE INDEX idx_guid ON podcasts(guid);

-- Create RSS feeds configuration table
CREATE TABLE IF NOT EXISTS rss_feeds (
  id SERIAL PRIMARY KEY,
  feed_url TEXT UNIQUE NOT NULL,
  feed_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert PulpMX RSS feeds
INSERT INTO rss_feeds (feed_url, feed_name) VALUES
  ('https://www.pulpmx.com/apptabs/z_tsms.xml', 'The Steve Matthes Show'),
  ('https://www.pulpmx.com/apptabs/z_pmxs.xml', 'PulpMX Show'),
  ('https://www.pulpmx.com/apptabs/z_reraceables.xml', 'The Re-Raceables'),
  ('https://www.pulpmx.com/apptabs/z_pmxpreshow.xml', 'The Fly Racing MOTO:60 Show'),
  ('https://www.pulpmx.com/apptabs/z_CC.xml', 'PulpMX Classic Commentary');

-- ADD THESE TABLES to your existing database.sql

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  published_date TIMESTAMP NOT NULL,
  image_url TEXT,
  author TEXT,
  excerpt TEXT,
  article_url TEXT,
  company TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  guid TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Motocross feeds table
CREATE TABLE IF NOT EXISTS motocross_feeds (
  id SERIAL PRIMARY KEY,
  feed_url TEXT UNIQUE NOT NULL,
  feed_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP,
  last_etag TEXT,
  last_modified TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_article_date ON articles(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_article_company ON articles(company);
CREATE INDEX IF NOT EXISTS idx_article_guid ON articles(guid);
