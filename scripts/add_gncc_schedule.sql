-- Add GNCC (Grand National Cross Country) 2026 schedule
-- Source: https://gnccracing.com/events
-- GNCC events run Sat-Sun; ATV Pro race ~10 AM ET, Bike Pro race ~1 PM ET
-- Times shown in AKDT (UTC-8) = ET minus 4 hours

-- Step 1: Drop existing CHECK constraint and recreate with 'gncc' included
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_series_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_series_check
  CHECK (series IN ('supercross', 'mxgp', 'promx', 'smx', 'canadian', 'gncc'));

-- Step 2: Insert 2026 GNCC schedule (all rounds, past ones will auto-expire from API)
INSERT INTO schedules (series, round, name, location, start_date, end_date, start_time_akst) VALUES
  ('gncc', '1',  'Big Buck',             'Big Buck Farm, Union, SC',                          '2026-02-14', '2026-02-15', '9:00 AM AKST'),
  ('gncc', '2',  'Wild Boar',            'Hog Waller, Palatka, FL',                           '2026-02-28', '2026-03-01', '9:00 AM AKST'),
  ('gncc', '3',  'Talladega',            'Talladega Superspeedway, Lincoln, AL',               '2026-03-07', '2026-03-08', '9:00 AM AKST'),
  ('gncc', '4',  'Camp Coker Bullet',    'Moree''s Sportsman''s Preserve, Society Hill, SC',  '2026-03-28', '2026-03-29', '9:00 AM AKDT'),
  ('gncc', '5',  'The Dukes',            'Mine Made Adventure Park, Leburn, KY',               '2026-04-18', '2026-04-19', '9:00 AM AKDT'),
  ('gncc', '6',  'The Old Gray',         'The Old Gray Entertainment Venue, Monterey, TN',    '2026-05-01', '2026-05-03', '9:00 AM AKDT'),
  ('gncc', '7',  'Powerline Park',       'Powerline Park, St. Clairsville, OH',               '2026-05-15', '2026-05-17', '9:00 AM AKDT'),
  ('gncc', '8',  'Watkins Glen',         'Watkins Glen International, Watkins Glen, NY',       '2026-06-06', '2026-06-07', '9:00 AM AKDT'),
  ('gncc', '9',  'Snowshoe',             'Snowshoe Mountain Resort, Snowshoe, WV',             '2026-06-26', '2026-06-28', '9:00 AM AKDT'),
  ('gncc', '10', 'The John Penton',      'Sunday Creek Raceway, Millfield, OH',                '2026-09-18', '2026-09-20', '9:00 AM AKDT'),
  ('gncc', '11', 'Mason-Dixon',          'Mathews Farm, Mount Morris, PA',                    '2026-10-02', '2026-10-04', '9:00 AM AKDT'),
  ('gncc', '12', 'Ironman',              'Ironman Raceway, Crawfordsville, IN',                '2026-10-23', '2026-10-25', '9:00 AM AKDT'),
  ('gncc', '13', 'Buckwheat 100',        'CJ Raceway, Newburg, WV',                           '2026-11-06', '2026-11-08', '9:00 AM AKST')
ON CONFLICT DO NOTHING;
