-- Game Tables for MX Racing Game
-- Run this in Supabase SQL Editor

-- Players table (linked to RevenueCat userId)
CREATE TABLE game_players (
  user_id     TEXT PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  banned      BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Constraint to enforce valid player names
ALTER TABLE game_players 
ADD CONSTRAINT player_name_format 
CHECK (player_name ~ '^[a-zA-Z0-9 _\-\.]{2,16}$');

-- Scores table
CREATE TABLE game_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  player_name    TEXT NOT NULL,
  track_id       INTEGER NOT NULL,
  race_time_ms   INTEGER NOT NULL,
  best_lap_ms    INTEGER,
  finish_pos     INTEGER,
  completed_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes for leaderboard queries
CREATE INDEX idx_scores_track_race 
  ON game_scores (track_id, completed_at, race_time_ms);

CREATE INDEX idx_scores_track_lap  
  ON game_scores (track_id, completed_at, best_lap_ms);

-- Index for user lookups
CREATE INDEX idx_scores_user 
  ON game_scores (user_id);

-- Enable RLS (Row Level Security) but allow public read for leaderboards
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for leaderboards)
CREATE POLICY "Public read game_players" ON game_players
  FOR SELECT USING (true);

CREATE POLICY "Public read game_scores" ON game_scores
  FOR SELECT USING (true);

-- Allow insert/update via service role (API)
CREATE POLICY "Service insert game_players" ON game_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service insert game_scores" ON game_scores
  FOR INSERT WITH CHECK (true);
