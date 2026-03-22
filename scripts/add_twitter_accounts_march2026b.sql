-- Add mitch_kendra to tracked Twitter accounts

INSERT INTO twitter_accounts (username, display_name) VALUES
  ('mitch_kendra', 'Mitch Kendra')
ON CONFLICT (username) DO NOTHING;
