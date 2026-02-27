-- Migration: Race notification preferences and UTC start times
--
-- 1. Add race_preferences JSONB to push_tokens
--    Stores per-series opt-in: { supercross, mxgp, motocross, canadian }
--    Defaults all true so existing users get all race reminders until they opt out.
--
-- 2. Add start_datetime_utc to schedules
--    Lets the cron job do a clean UTC comparison without parsing display strings.

-- ── push_tokens ─────────────────────────────────────────────────────────────
ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS race_preferences JSONB NOT NULL DEFAULT '{
    "supercross": true,
    "mxgp": true,
    "motocross": true,
    "canadian": true
  }'::jsonb;

-- ── schedules ────────────────────────────────────────────────────────────────
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS start_datetime_utc TIMESTAMPTZ;

-- Populate start_datetime_utc from the real AKST/AKDT start times.
-- AKST = UTC-9 (rounds before Mar 8 DST change)
-- AKDT = UTC-8 (rounds from Mar 8 onward)

-- AMA Supercross
UPDATE schedules SET start_datetime_utc = '2026-03-01T00:00:00Z' WHERE series = 'supercross' AND round = '8';
UPDATE schedules SET start_datetime_utc = '2026-03-08T00:00:00Z' WHERE series = 'supercross' AND round = '9';
UPDATE schedules SET start_datetime_utc = '2026-03-21T23:00:00Z' WHERE series = 'supercross' AND round = '10';
UPDATE schedules SET start_datetime_utc = '2026-03-28T23:00:00Z' WHERE series = 'supercross' AND round = '11';
UPDATE schedules SET start_datetime_utc = '2026-04-04T23:00:00Z' WHERE series = 'supercross' AND round = '12';
UPDATE schedules SET start_datetime_utc = '2026-04-11T19:00:00Z' WHERE series = 'supercross' AND round = '13';
UPDATE schedules SET start_datetime_utc = '2026-04-18T19:00:00Z' WHERE series = 'supercross' AND round = '14';
UPDATE schedules SET start_datetime_utc = '2026-04-25T23:00:00Z' WHERE series = 'supercross' AND round = '15';
UPDATE schedules SET start_datetime_utc = '2026-05-02T23:00:00Z' WHERE series = 'supercross' AND round = '16';
UPDATE schedules SET start_datetime_utc = '2026-05-09T23:00:00Z' WHERE series = 'supercross' AND round = '17';

-- MXGP (Saturday qualifying start)
UPDATE schedules SET start_datetime_utc = '2026-03-07T19:00:00Z' WHERE series = 'mxgp' AND round = '1';
UPDATE schedules SET start_datetime_utc = '2026-03-21T14:10:00Z' WHERE series = 'mxgp' AND round = '2';
UPDATE schedules SET start_datetime_utc = '2026-03-28T14:10:00Z' WHERE series = 'mxgp' AND round = '3';
UPDATE schedules SET start_datetime_utc = '2026-04-11T13:10:00Z' WHERE series = 'mxgp' AND round = '4';
UPDATE schedules SET start_datetime_utc = '2026-04-18T13:10:00Z' WHERE series = 'mxgp' AND round = '5';
UPDATE schedules SET start_datetime_utc = '2026-05-23T13:10:00Z' WHERE series = 'mxgp' AND round = '6';
UPDATE schedules SET start_datetime_utc = '2026-05-30T13:10:00Z' WHERE series = 'mxgp' AND round = '7';
UPDATE schedules SET start_datetime_utc = '2026-06-06T12:10:00Z' WHERE series = 'mxgp' AND round = '8';
UPDATE schedules SET start_datetime_utc = '2026-06-20T13:10:00Z' WHERE series = 'mxgp' AND round = '9';
UPDATE schedules SET start_datetime_utc = '2026-06-27T14:10:00Z' WHERE series = 'mxgp' AND round = '10';
UPDATE schedules SET start_datetime_utc = '2026-07-04T12:10:00Z' WHERE series = 'mxgp' AND round = '11';
UPDATE schedules SET start_datetime_utc = '2026-07-18T13:10:00Z' WHERE series = 'mxgp' AND round = '12';
UPDATE schedules SET start_datetime_utc = '2026-07-25T13:10:00Z' WHERE series = 'mxgp' AND round = '13';
UPDATE schedules SET start_datetime_utc = '2026-08-01T13:10:00Z' WHERE series = 'mxgp' AND round = '14';
UPDATE schedules SET start_datetime_utc = '2026-08-15T13:10:00Z' WHERE series = 'mxgp' AND round = '15';
UPDATE schedules SET start_datetime_utc = '2026-08-22T13:10:00Z' WHERE series = 'mxgp' AND round = '16';
UPDATE schedules SET start_datetime_utc = '2026-09-05T12:10:00Z' WHERE series = 'mxgp' AND round = '17';
UPDATE schedules SET start_datetime_utc = '2026-09-13T07:10:00Z' WHERE series = 'mxgp' AND round = '18';
UPDATE schedules SET start_datetime_utc = '2026-09-20T05:10:00Z' WHERE series = 'mxgp' AND round = '19';

-- AMA Pro Motocross
UPDATE schedules SET start_datetime_utc = '2026-05-30T17:00:00Z' WHERE series = 'promx' AND round = '1';
UPDATE schedules SET start_datetime_utc = '2026-06-06T17:00:00Z' WHERE series = 'promx' AND round = '2';
UPDATE schedules SET start_datetime_utc = '2026-06-13T16:00:00Z' WHERE series = 'promx' AND round = '3';
UPDATE schedules SET start_datetime_utc = '2026-06-20T14:00:00Z' WHERE series = 'promx' AND round = '4';
UPDATE schedules SET start_datetime_utc = '2026-07-04T14:00:00Z' WHERE series = 'promx' AND round = '5';
UPDATE schedules SET start_datetime_utc = '2026-07-11T14:00:00Z' WHERE series = 'promx' AND round = '6';
UPDATE schedules SET start_datetime_utc = '2026-07-18T15:00:00Z' WHERE series = 'promx' AND round = '7';
UPDATE schedules SET start_datetime_utc = '2026-07-25T17:00:00Z' WHERE series = 'promx' AND round = '8';
UPDATE schedules SET start_datetime_utc = '2026-08-15T14:00:00Z' WHERE series = 'promx' AND round = '9';
UPDATE schedules SET start_datetime_utc = '2026-08-22T14:00:00Z' WHERE series = 'promx' AND round = '10';
UPDATE schedules SET start_datetime_utc = '2026-08-29T14:00:00Z' WHERE series = 'promx' AND round = '11';

-- SMX Playoffs
UPDATE schedules SET start_datetime_utc = '2026-09-12T19:00:00Z' WHERE series = 'smx' AND round = 'P1';
UPDATE schedules SET start_datetime_utc = '2026-09-19T19:00:00Z' WHERE series = 'smx' AND round = 'P2';
UPDATE schedules SET start_datetime_utc = '2026-09-26T19:00:00Z' WHERE series = 'smx' AND round = 'F';

-- Canadian Triple Crown
UPDATE schedules SET start_datetime_utc = '2026-06-07T19:00:00Z' WHERE series = 'canadian' AND round = '1';
UPDATE schedules SET start_datetime_utc = '2026-06-14T18:00:00Z' WHERE series = 'canadian' AND round = '2';
UPDATE schedules SET start_datetime_utc = '2026-06-28T17:00:00Z' WHERE series = 'canadian' AND round = '3';
UPDATE schedules SET start_datetime_utc = '2026-07-05T17:00:00Z' WHERE series = 'canadian' AND round = '4';
UPDATE schedules SET start_datetime_utc = '2026-07-12T16:00:00Z' WHERE series = 'canadian' AND round = '5';
UPDATE schedules SET start_datetime_utc = '2026-07-19T17:00:00Z' WHERE series = 'canadian' AND round = '6';
UPDATE schedules SET start_datetime_utc = '2026-07-26T17:00:00Z' WHERE series = 'canadian' AND round = '7';
UPDATE schedules SET start_datetime_utc = '2026-08-09T17:00:00Z' WHERE series = 'canadian' AND round = '8';

-- Index for the cron's time-window query
CREATE INDEX IF NOT EXISTS idx_schedules_start_utc
  ON schedules (start_datetime_utc ASC)
  WHERE start_datetime_utc IS NOT NULL;
