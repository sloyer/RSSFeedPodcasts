-- Race Events Table for 2026 Season Schedule
-- Powers the "Live" tab visibility and race day push notifications

-- Create the race_events table
CREATE TABLE IF NOT EXISTS race_events (
  id SERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  series TEXT NOT NULL,  -- 'supercross', 'motocross', 'smx'
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  coverage_start_utc TIMESTAMP WITH TIME ZONE NOT NULL,  -- 10 AM local (morning practice)
  gate_drop_utc TIMESTAMP WITH TIME ZONE NOT NULL,       -- Main event start
  timezone TEXT NOT NULL,  -- 'America/Los_Angeles', etc.
  is_tbd BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_race_events_coverage_start ON race_events(coverage_start_utc);
CREATE INDEX IF NOT EXISTS idx_race_events_gate_drop ON race_events(gate_drop_utc);
CREATE INDEX IF NOT EXISTS idx_race_events_series ON race_events(series);

-- Clear existing events (for re-seeding)
DELETE FROM race_events;

-- ============================================================================
-- 2026 SUPERCROSS SCHEDULE (Rounds 1-17)
-- ============================================================================
-- coverage_start_utc = 10 AM local converted to UTC
-- gate_drop_utc = Main event gate drop converted to UTC
-- PST = UTC-8, CST = UTC-6, EST = UTC-5, MST = UTC-7 (winter)
-- PDT = UTC-7, CDT = UTC-5, EDT = UTC-4, MDT = UTC-6 (summer, after Mar 8)

INSERT INTO race_events (round, series, venue, city, state, coverage_start_utc, gate_drop_utc, timezone, is_tbd) VALUES
-- Round 1: Jan 10 | 10AM PST = 6PM UTC | 4PM PST = Jan 11, 12AM UTC
(1, 'supercross', 'Angel Stadium', 'Anaheim', 'CA', 
   '2026-01-10T18:00:00Z', '2026-01-11T00:00:00Z', 'America/Los_Angeles', false),

-- Round 2: Jan 17 | 10AM PST = 6PM UTC | 4PM PST = Jan 18, 12AM UTC
(2, 'supercross', 'Snapdragon Stadium', 'San Diego', 'CA', 
   '2026-01-17T18:00:00Z', '2026-01-18T00:00:00Z', 'America/Los_Angeles', false),

-- Round 3: Jan 24 | 10AM PST = 6PM UTC | 4PM PST = Jan 25, 12AM UTC
(3, 'supercross', 'Angel Stadium', 'Anaheim', 'CA', 
   '2026-01-24T18:00:00Z', '2026-01-25T00:00:00Z', 'America/Los_Angeles', false),

-- Round 4: Jan 31 | 10AM CST = 4PM UTC | 6PM CST = Feb 1, 12AM UTC
(4, 'supercross', 'NRG Stadium', 'Houston', 'TX', 
   '2026-01-31T16:00:00Z', '2026-02-01T00:00:00Z', 'America/Chicago', false),

-- Round 5: Feb 7 | 10AM MST = 5PM UTC | 5PM MST = Feb 8, 12AM UTC (Arizona no DST)
(5, 'supercross', 'State Farm Stadium', 'Glendale', 'AZ', 
   '2026-02-07T17:00:00Z', '2026-02-08T00:00:00Z', 'America/Phoenix', false),

-- Round 6: Feb 14 | 10AM PST = 6PM UTC | 4PM PST = Feb 15, 12AM UTC
(6, 'supercross', 'Lumen Field', 'Seattle', 'WA', 
   '2026-02-14T18:00:00Z', '2026-02-15T00:00:00Z', 'America/Los_Angeles', false),

-- Round 7: Feb 21 | 10AM CST = 4PM UTC | 6PM CST = Feb 22, 12AM UTC
(7, 'supercross', 'AT&T Stadium', 'Arlington', 'TX', 
   '2026-02-21T16:00:00Z', '2026-02-22T00:00:00Z', 'America/Chicago', false),

-- Round 8: Feb 28 | 10AM EST = 3PM UTC | 7PM EST = Mar 1, 12AM UTC
(8, 'supercross', 'Daytona International Speedway', 'Daytona Beach', 'FL', 
   '2026-02-28T15:00:00Z', '2026-03-01T00:00:00Z', 'America/New_York', false),

-- Round 9: Mar 7 | 10AM EST = 3PM UTC | 7PM EST = Mar 8, 12AM UTC
(9, 'supercross', 'Lucas Oil Stadium', 'Indianapolis', 'IN', 
   '2026-03-07T15:00:00Z', '2026-03-08T00:00:00Z', 'America/New_York', false),

-- Round 10: Mar 21 | 10AM CDT = 3PM UTC | 6PM CDT = 11PM UTC (after DST)
(10, 'supercross', 'Protective Stadium', 'Birmingham', 'AL', 
    '2026-03-21T15:00:00Z', '2026-03-21T23:00:00Z', 'America/Chicago', false),

-- Round 11: Mar 28 | 10AM EDT = 2PM UTC | 7PM EDT = 11PM UTC
(11, 'supercross', 'Ford Field', 'Detroit', 'MI', 
    '2026-03-28T14:00:00Z', '2026-03-28T23:00:00Z', 'America/New_York', false),

-- Round 12: Apr 4 | 10AM CDT = 3PM UTC | 6PM CDT = 11PM UTC
(12, 'supercross', 'The Dome at America''s Center', 'St. Louis', 'MO', 
    '2026-04-04T15:00:00Z', '2026-04-04T23:00:00Z', 'America/Chicago', false),

-- Round 13: Apr 11 | 10AM CDT = 3PM UTC | 2PM CDT = 7PM UTC
(13, 'supercross', 'Nissan Stadium', 'Nashville', 'TN', 
    '2026-04-11T15:00:00Z', '2026-04-11T19:00:00Z', 'America/Chicago', false),

-- Round 14: Apr 18 | 10AM EDT = 2PM UTC | 3PM EDT = 7PM UTC
(14, 'supercross', 'Huntington Bank Field', 'Cleveland', 'OH', 
    '2026-04-18T14:00:00Z', '2026-04-18T19:00:00Z', 'America/New_York', false),

-- Round 15: Apr 25 | 10AM EDT = 2PM UTC | 7PM EDT = 11PM UTC
(15, 'supercross', 'Lincoln Financial Field', 'Philadelphia', 'PA', 
    '2026-04-25T14:00:00Z', '2026-04-25T23:00:00Z', 'America/New_York', false),

-- Round 16: May 2 | 10AM MDT = 4PM UTC | 5PM MDT = 11PM UTC
(16, 'supercross', 'Empower Field at Mile High', 'Denver', 'CO', 
    '2026-05-02T16:00:00Z', '2026-05-02T23:00:00Z', 'America/Denver', false),

-- Round 17: May 9 | 10AM MDT = 4PM UTC | 5PM MDT = 11PM UTC
(17, 'supercross', 'Rice-Eccles Stadium', 'Salt Lake City', 'UT', 
    '2026-05-09T16:00:00Z', '2026-05-09T23:00:00Z', 'America/Denver', false);

-- ============================================================================
-- 2026 PRO MOTOCROSS SCHEDULE (Rounds 18-28)
-- ============================================================================

INSERT INTO race_events (round, series, venue, city, state, coverage_start_utc, gate_drop_utc, timezone, is_tbd) VALUES
-- Round 18: May 30 | 10AM PDT = 5PM UTC | 1PM PDT = 8PM UTC
(18, 'motocross', 'Fox Raceway', 'Pala', 'CA', 
    '2026-05-30T17:00:00Z', '2026-05-30T20:00:00Z', 'America/Los_Angeles', false),

-- Round 19: Jun 6 | 10AM PDT = 5PM UTC | 1PM PDT = 8PM UTC
(19, 'motocross', 'Hangtown', 'Sacramento', 'CA', 
    '2026-06-06T17:00:00Z', '2026-06-06T20:00:00Z', 'America/Los_Angeles', false),

-- Round 20: Jun 13 | 10AM MDT = 4PM UTC | 1PM MDT = 7PM UTC
(20, 'motocross', 'Thunder Valley', 'Lakewood', 'CO', 
    '2026-06-13T16:00:00Z', '2026-06-13T19:00:00Z', 'America/Denver', false),

-- Round 21: Jun 20 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(21, 'motocross', 'High Point', 'Mount Morris', 'PA', 
    '2026-06-20T14:00:00Z', '2026-06-20T17:00:00Z', 'America/New_York', false),

-- Round 22: Jul 4 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(22, 'motocross', 'RedBud', 'Buchanan', 'MI', 
    '2026-07-04T14:00:00Z', '2026-07-04T17:00:00Z', 'America/New_York', false),

-- Round 23: Jul 11 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(23, 'motocross', 'Southwick', 'Southwick', 'MA', 
    '2026-07-11T14:00:00Z', '2026-07-11T17:00:00Z', 'America/New_York', false),

-- Round 24: Jul 18 | 10AM CDT = 3PM UTC | 1PM CDT = 6PM UTC
(24, 'motocross', 'Spring Creek', 'Millville', 'MN', 
    '2026-07-18T15:00:00Z', '2026-07-18T18:00:00Z', 'America/Chicago', false),

-- Round 25: Jul 25 | 10AM PDT = 5PM UTC | 12PM PDT = 7PM UTC
(25, 'motocross', 'Washougal', 'Washougal', 'WA', 
    '2026-07-25T17:00:00Z', '2026-07-25T19:00:00Z', 'America/Los_Angeles', false),

-- Round 26: Aug 15 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(26, 'motocross', 'Unadilla', 'New Berlin', 'NY', 
    '2026-08-15T14:00:00Z', '2026-08-15T17:00:00Z', 'America/New_York', false),

-- Round 27: Aug 22 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(27, 'motocross', 'Budds Creek', 'Mechanicsville', 'MD', 
    '2026-08-22T14:00:00Z', '2026-08-22T17:00:00Z', 'America/New_York', false),

-- Round 28: Aug 29 | 10AM EDT = 2PM UTC | 1PM EDT = 5PM UTC
(28, 'motocross', 'Ironman', 'Crawfordsville', 'IN', 
    '2026-08-29T14:00:00Z', '2026-08-29T17:00:00Z', 'America/New_York', false);

-- ============================================================================
-- 2026 SMX PLAYOFFS SCHEDULE (Rounds 29-31) - TBD
-- ============================================================================

INSERT INTO race_events (round, series, venue, city, state, coverage_start_utc, gate_drop_utc, timezone, is_tbd) VALUES
-- Playoff 1: Sep 12 (venue/time TBD - placeholder 10AM/6PM EDT)
(29, 'smx', 'TBD', 'TBD', NULL, 
    '2026-09-12T14:00:00Z', '2026-09-12T22:00:00Z', 'America/New_York', true),

-- Playoff 2: Sep 19 (venue/time TBD - placeholder 10AM/6PM EDT)
(30, 'smx', 'TBD', 'TBD', NULL, 
    '2026-09-19T14:00:00Z', '2026-09-19T22:00:00Z', 'America/New_York', true),

-- SMX Final: Sep 26 (venue/time TBD - placeholder 10AM/6PM EDT)
(31, 'smx', 'TBD', 'TBD', NULL, 
    '2026-09-26T14:00:00Z', '2026-09-26T22:00:00Z', 'America/New_York', true);

-- Verify the data
SELECT 
  round, 
  series, 
  venue, 
  city || ', ' || COALESCE(state, '') as location,
  coverage_start_utc,
  gate_drop_utc,
  timezone,
  is_tbd
FROM race_events 
ORDER BY round;
