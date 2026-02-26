-- New schedules table for the Schedule tab
-- Covers AMA Supercross and MXGP (SMX excluded - has its own sheet)
-- Events are automatically hidden the day after they end (handled in API query)

CREATE TABLE IF NOT EXISTS schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series          TEXT NOT NULL CHECK (series IN ('supercross', 'mxgp')),
  name            TEXT NOT NULL,        -- e.g. "Seattle Supercross" or "MXGP of Argentina"
  location        TEXT NOT NULL,        -- e.g. "Lumen Field, Seattle, WA"
  start_date      DATE NOT NULL,
  end_date        DATE,                 -- NULL = single day event; set for multi-day events
  start_time_akst TEXT,                 -- e.g. "7:00 PM" — stored as display string in AKST
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for the most common query: upcoming events ordered by date
CREATE INDEX IF NOT EXISTS idx_schedules_series_date
  ON schedules (series, start_date ASC);

-- Sample Supercross data (2025 season — update as needed)
INSERT INTO schedules (series, name, location, start_date, start_time_akst) VALUES
  ('supercross', 'Anaheim 1',        'Angel Stadium, Anaheim, CA',          '2025-01-11', '6:00 PM'),
  ('supercross', 'San Diego',        'Snapdragon Stadium, San Diego, CA',   '2025-01-18', '6:00 PM'),
  ('supercross', 'Anaheim 2',        'Angel Stadium, Anaheim, CA',          '2025-01-25', '6:00 PM'),
  ('supercross', 'Indianapolis',     'Lucas Oil Stadium, Indianapolis, IN', '2025-02-01', '5:00 PM'),
  ('supercross', 'Glendale',         'State Farm Stadium, Glendale, AZ',    '2025-02-08', '6:00 PM'),
  ('supercross', 'Tampa',            'Raymond James Stadium, Tampa, FL',    '2025-02-15', '5:00 PM'),
  ('supercross', 'Arlington',        'AT&T Stadium, Arlington, TX',         '2025-02-22', '5:00 PM'),
  ('supercross', 'Daytona',          'Daytona International Speedway, FL',  '2025-03-08', '5:00 PM'),
  ('supercross', 'Detroit',          'Ford Field, Detroit, MI',             '2025-03-15', '5:00 PM'),
  ('supercross', 'Cincinnati',       'Paycor Stadium, Cincinnati, OH',      '2025-03-22', '5:00 PM'),
  ('supercross', 'St. Louis',        'The Dome at America''s Center, MO',   '2025-03-29', '5:00 PM'),
  ('supercross', 'Philadelphia',     'Lincoln Financial Field, Philadelphia, PA', '2025-04-05', '5:00 PM'),
  ('supercross', 'Denver',           'Empower Field, Denver, CO',           '2025-04-12', '6:00 PM'),
  ('supercross', 'Seattle',          'Lumen Field, Seattle, WA',            '2025-04-19', '6:00 PM'),
  ('supercross', 'Las Vegas',        'Allegiant Stadium, Las Vegas, NV',    '2025-05-03', '6:00 PM');

-- Sample MXGP data (2025 season — update as needed)
INSERT INTO schedules (series, name, location, start_date, end_date, start_time_akst) VALUES
  ('mxgp', 'MXGP of Argentina',     'Villa La Angostura, Argentina',  '2025-03-01', '2025-03-02', '8:00 AM'),
  ('mxgp', 'MXGP of Patagonia Argentina', 'Neuquén, Argentina',       '2025-03-08', '2025-03-09', '8:00 AM'),
  ('mxgp', 'MXGP of Portugal',      'Agueda, Portugal',               '2025-03-29', '2025-03-30', '5:00 AM'),
  ('mxgp', 'MXGP of Spain',         'Intu Xanadú, Madrid, Spain',     '2025-04-05', '2025-04-06', '5:00 AM'),
  ('mxgp', 'MXGP of France',        'Saint Jean d''Angély, France',   '2025-04-12', '2025-04-13', '5:00 AM'),
  ('mxgp', 'MXGP of Germany',       'Teutschenthal, Germany',         '2025-04-26', '2025-04-27', '5:00 AM'),
  ('mxgp', 'MXGP of Latvia',        'Kegums, Latvia',                 '2025-05-17', '2025-05-18', '5:00 AM'),
  ('mxgp', 'MXGP of Italy',         'Maggiora Park, Italy',           '2025-05-24', '2025-05-25', '5:00 AM'),
  ('mxgp', 'MXGP of USA',           'Fox Raceway, Pala, CA',          '2025-06-21', '2025-06-22', '9:00 AM'),
  ('mxgp', 'MXGP of Indonesia',     'Sumbawa, Indonesia',             '2025-07-05', '2025-07-06', '6:00 AM');
