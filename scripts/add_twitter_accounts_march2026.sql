-- Add 7 new Twitter accounts to track (March 2026)
-- Note: @Josh_Wahlers and @SupercrossLIVE are already tracked

INSERT INTO twitter_accounts (username, display_name) VALUES
  ('DnxShow', 'DNX Show'),
  ('PulpmxShow', 'PulpMX Show'),
  ('mxgp', 'MXGP'),
  ('Dirtbike_Lovers', 'Dirtbike Lovers'),
  ('kellenbrauer', 'Kellen Brauer'),
  ('fowlersfacts', 'Fowler''s Facts'),
  ('Motopivot1', 'Moto Pivot')
ON CONFLICT (username) DO NOTHING;
