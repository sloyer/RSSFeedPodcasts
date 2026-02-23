-- Migration: Add mute and global notification control columns to push_tokens
-- Fixes:
--   1. muted_until: backend-enforced mute so "Mute 24h" actually stops push delivery
--   2. notifications_globally_enabled: lets cron jobs skip users who have turned off
--      all notifications (currently only notification_preferences is checked, not by
--      cron-inactive-reminder or cron-race-notifications)

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_globally_enabled BOOLEAN NOT NULL DEFAULT true;

-- Index to speed up cron queries that filter active, unmuted, globally-enabled users
CREATE INDEX IF NOT EXISTS idx_push_tokens_active_notif
  ON push_tokens (is_active, notifications_globally_enabled, muted_until)
  WHERE is_active = true AND notifications_globally_enabled = true;
