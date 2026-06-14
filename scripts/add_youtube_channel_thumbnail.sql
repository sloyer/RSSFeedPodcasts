-- Add thumbnail_url column to youtube_channels table
ALTER TABLE youtube_channels
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
