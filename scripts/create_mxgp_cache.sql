-- MXGP results cache table
-- Stores scraped data from results.mxgp.com keyed by a string cache key.
-- The cron job (api/cron-mxgp.js) populates this; API endpoints read from it.

CREATE TABLE IF NOT EXISTS mxgp_cache (
  key         TEXT PRIMARY KEY,
  data        JSONB        NOT NULL,
  fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

-- Index for quick expiry checks
CREATE INDEX IF NOT EXISTS mxgp_cache_expires_at ON mxgp_cache (expires_at);

-- Comment
COMMENT ON TABLE mxgp_cache IS
  'Scraped MXGP race results, sessions, standings. Populated by cron-mxgp. Read by /api/mxgp/* endpoints.';
