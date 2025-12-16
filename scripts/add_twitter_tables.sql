-- Twitter Feed Integration Tables

-- Table for Twitter accounts to track
CREATE TABLE IF NOT EXISTS twitter_accounts (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for tweets (only last 3 days)
CREATE TABLE IF NOT EXISTS tweets (
  id SERIAL PRIMARY KEY,
  twitter_id TEXT UNIQUE NOT NULL, -- Tweet ID from Twitter
  account_username TEXT NOT NULL,
  text TEXT NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  posted_at TIMESTAMP NOT NULL,
  tweet_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (account_username) REFERENCES twitter_accounts(username) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_account ON tweets(account_username);
CREATE INDEX IF NOT EXISTS idx_twitter_accounts_active ON twitter_accounts(is_active);

-- Function to auto-delete tweets older than 3 days
CREATE OR REPLACE FUNCTION delete_old_tweets()
RETURNS void AS $$
BEGIN
  DELETE FROM tweets 
  WHERE posted_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

-- Insert the 13 accounts to track
INSERT INTO twitter_accounts (username, display_name) VALUES
  ('LewisPhillips71', 'Lewis Phillips'),
  ('pulpmx', 'PulpMX'),
  ('racerxonline', 'Racer X Online'),
  ('Danielblair125', 'Daniel Blair'),
  ('Jason66Thomas', 'Jason Thomas'),
  ('filthyphil__', 'Phil Nicoletti'),
  ('Darksidemx3', 'Darkside'),
  ('JasonWeigandt', 'Jason Weigandt'),
  ('KKeefer120', 'Kris Keefer'),
  ('SupercrossLIVE', 'Supercross LIVE'),
  ('ProMotocross', 'Pro Motocross'),
  ('MattBurkeen820', 'Matt Burkeen'),
  ('Josh_Wahlers', 'Josh Wahlers')
ON CONFLICT (username) DO NOTHING;


