-- Schedules table for the Schedule tab
-- Covers: AMA Supercross, MXGP, AMA Pro Motocross, SMX Playoffs, Canadian Triple Crown
-- Events auto-expire: API filters end_date >= today (or start_date for single-day events)

CREATE TABLE IF NOT EXISTS schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series          TEXT NOT NULL CHECK (series IN ('supercross', 'mxgp', 'promx', 'smx', 'canadian')),
  round           TEXT NOT NULL,   -- "8", "9", "P1", "P2", "F", etc.
  name            TEXT NOT NULL,   -- Event/track name
  location        TEXT NOT NULL,   -- Venue + city
  start_date      DATE NOT NULL,   -- First day (single-day events: just this date)
  end_date        DATE,            -- Last day for multi-day events (NULL = single day)
  start_time_akst TEXT,            -- Display string in Alaska time, e.g. "3:00 PM AKST"
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_series_date
  ON schedules (series, start_date ASC);

-- Wipe any old/sample data before inserting real data
TRUNCATE schedules;

-- ============================================================
-- AMA SUPERCROSS 2026 (Remaining rounds: Rd 8–17)
-- Rounds 1–7 already completed
-- ============================================================
INSERT INTO schedules (series, round, name, location, start_date, start_time_akst) VALUES
  ('supercross', '8',  'Daytona',         'Daytona Int''l Speedway, Daytona, FL',      '2026-02-28', '3:00 PM AKST'),
  ('supercross', '9',  'Indianapolis',    'Lucas Oil Stadium, Indianapolis, IN',        '2026-03-07', '3:00 PM AKST'),
  ('supercross', '10', 'Birmingham',      'Protective Stadium, Birmingham, AL',         '2026-03-21', '3:00 PM AKDT'),
  ('supercross', '11', 'Detroit',         'Ford Field, Detroit, MI',                   '2026-03-28', '3:00 PM AKDT'),
  ('supercross', '12', 'St. Louis',       'Dome at America''s Center, St. Louis, MO',  '2026-04-04', '3:00 PM AKDT'),
  ('supercross', '13', 'Nashville',       'Nissan Stadium, Nashville, TN',             '2026-04-11', '11:00 AM AKDT'),
  ('supercross', '14', 'Cleveland',       'Huntington Bank Field, Cleveland, OH',      '2026-04-18', '11:00 AM AKDT'),
  ('supercross', '15', 'Philadelphia',    'Lincoln Financial Field, Philadelphia, PA', '2026-04-25', '3:00 PM AKDT'),
  ('supercross', '16', 'Denver',          'Empower Field at Mile High, Denver, CO',    '2026-05-02', '3:00 PM AKDT'),
  ('supercross', '17', 'Salt Lake City',  'Rice-Eccles Stadium, Salt Lake City, UT',   '2026-05-09', '3:00 PM AKDT');

-- ============================================================
-- MXGP 2026 (Two-day events: Sat qualifying, Sun racing)
-- start_time_akst = Saturday qualifying start
-- ============================================================
INSERT INTO schedules (series, round, name, location, start_date, end_date, start_time_akst) VALUES
  ('mxgp', '1',  'MXGP of Argentina',      'Bariloche, Argentina',           '2026-03-07', '2026-03-08', '10:00 AM AKST'),
  ('mxgp', '2',  'MXGP of Andalucia',      'Almonte, Spain',                 '2026-03-21', '2026-03-22', '6:10 AM AKDT'),
  ('mxgp', '3',  'MXGP of Switzerland',    'Frauenfeld, Switzerland',        '2026-03-28', '2026-03-29', '6:10 AM AKDT'),
  ('mxgp', '4',  'MXGP of Sardegna',       'Riola Sardo, Italy',             '2026-04-11', '2026-04-12', '5:10 AM AKDT'),
  ('mxgp', '5',  'MXGP of Trentino',       'Pietramurata, Italy',            '2026-04-18', '2026-04-19', '5:10 AM AKDT'),
  ('mxgp', '6',  'MXGP of France',         'Lacapelle Marival, France',      '2026-05-23', '2026-05-24', '5:10 AM AKDT'),
  ('mxgp', '7',  'MXGP of Germany',        'Teutschenthal, Germany',         '2026-05-30', '2026-05-31', '5:10 AM AKDT'),
  ('mxgp', '8',  'MXGP of Latvia',         'Kegums, Latvia',                 '2026-06-06', '2026-06-07', '4:10 AM AKDT'),
  ('mxgp', '9',  'MXGP of Italy',          'Montevarchi, Italy',             '2026-06-20', '2026-06-21', '5:10 AM AKDT'),
  ('mxgp', '10', 'MXGP of Portugal',       'Águeda, Portugal',               '2026-06-27', '2026-06-28', '6:10 AM AKDT'),
  ('mxgp', '11', 'MXGP of South Africa',   'Johannesburg, South Africa',     '2026-07-04', '2026-07-05', '4:10 AM AKDT'),
  ('mxgp', '12', 'MXGP of Great Britain',  'Foxhills, UK',                   '2026-07-18', '2026-07-19', '5:10 AM AKDT'),
  ('mxgp', '13', 'MXGP of Czech Republic', 'Loket, Czech Republic',          '2026-07-25', '2026-07-26', '5:10 AM AKDT'),
  ('mxgp', '14', 'MXGP of Flanders',       'Lommel, Belgium',                '2026-08-01', '2026-08-02', '5:10 AM AKDT'),
  ('mxgp', '15', 'MXGP of Sweden',         'Uddevalla, Sweden',              '2026-08-15', '2026-08-16', '5:10 AM AKDT'),
  ('mxgp', '16', 'MXGP of Netherlands',    'Arnhem, Netherlands',            '2026-08-22', '2026-08-23', '5:10 AM AKDT'),
  ('mxgp', '17', 'MXGP of Türkiye',        'Afyonkarahisar, Turkey',         '2026-09-05', '2026-09-06', '4:10 AM AKDT'),
  ('mxgp', '18', 'MXGP of China',          'Shanghai, China',                '2026-09-12', '2026-09-13', '11:10 PM AKDT'),
  ('mxgp', '19', 'MXGP of Australia',      'Darwin, Australia',              '2026-09-19', '2026-09-20', '9:10 PM AKDT');

-- ============================================================
-- AMA PRO MOTOCROSS 2026
-- ============================================================
INSERT INTO schedules (series, round, name, location, start_date, start_time_akst) VALUES
  ('promx', '1',  'Fox Raceway National',    'Fox Raceway, Pala, CA',              '2026-05-30', '9:00 AM AKDT'),
  ('promx', '2',  'Hangtown Classic',        'Rancho Cordova, CA',                 '2026-06-06', '9:00 AM AKDT'),
  ('promx', '3',  'Thunder Valley National', 'Lakewood, CO',                       '2026-06-13', '8:00 AM AKDT'),
  ('promx', '4',  'High Point National',     'Mt. Morris, PA',                     '2026-06-20', '6:00 AM AKDT'),
  ('promx', '5',  'RedBud National',         'Buchanan, MI',                       '2026-07-04', '6:00 AM AKDT'),
  ('promx', '6',  'Southwick National',      'Southwick, MA',                      '2026-07-11', '6:00 AM AKDT'),
  ('promx', '7',  'Spring Creek National',   'Millville, MN',                      '2026-07-18', '7:00 AM AKDT'),
  ('promx', '8',  'Washougal National',      'Washougal, WA',                      '2026-07-25', '9:00 AM AKDT'),
  ('promx', '9',  'Unadilla National',       'New Berlin, NY',                     '2026-08-15', '6:00 AM AKDT'),
  ('promx', '10', 'Budds Creek National',    'Mechanicsville, MD',                 '2026-08-22', '6:00 AM AKDT'),
  ('promx', '11', 'Ironman National',        'Crawfordsville, IN',                 '2026-08-29', '6:00 AM AKDT');

-- ============================================================
-- SMX WORLD CHAMPIONSHIP PLAYOFFS 2026
-- ============================================================
INSERT INTO schedules (series, round, name, location, start_date, start_time_akst) VALUES
  ('smx', 'P1', 'SMX Playoff 1',              'Historic Crew Stadium, Columbus, OH',        '2026-09-12', '11:00 AM AKDT'),
  ('smx', 'P2', 'SMX Playoff 2',              'Dignity Health Sports Park, Carson, CA',     '2026-09-19', '11:00 AM AKDT'),
  ('smx', 'F',  'SMX World Championship Final','Thunder Ridge Nature Arena, Ridgedale, MO', '2026-09-26', '11:00 AM AKDT');

-- ============================================================
-- CANADIAN TRIPLE CROWN 2026
-- ============================================================
INSERT INTO schedules (series, round, name, location, start_date, start_time_akst) VALUES
  ('canadian', '1', 'Wild Rose MX',       'Wild Rose MX, Calgary, AB',        '2026-06-07', '11:00 AM AKDT'),
  ('canadian', '2', 'Prairie Hill MX',    'Prairie Hill MX, Pilot Mound, MB', '2026-06-14', '10:00 AM AKDT'),
  ('canadian', '3', 'Motocross Ste-Julie','Ste-Julie, QC',                    '2026-06-28', '9:00 AM AKDT'),
  ('canadian', '4', 'Gopher Dunes MX',    'Gopher Dunes MX, Courtland, ON',   '2026-07-05', '9:00 AM AKDT'),
  ('canadian', '5', 'Riverglade MX',      'Riverglade MX, Moncton, NB',       '2026-07-12', '8:00 AM AKDT'),
  ('canadian', '6', 'Sand Del Lee MX',    'Sand Del Lee MX, Ottawa, ON',      '2026-07-19', '9:00 AM AKDT'),
  ('canadian', '7', 'MX Deschambault',    'MX Deschambault, Deschambault, QC','2026-07-26', '9:00 AM AKDT'),
  ('canadian', '8', 'Walton Raceway',     'Walton Raceway, Walton, ON',       '2026-08-09', '9:00 AM AKDT');
