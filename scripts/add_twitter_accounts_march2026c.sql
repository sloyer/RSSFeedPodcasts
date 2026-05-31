-- Add SuperMotocross to tracked Twitter accounts

INSERT INTO twitter_accounts (username, display_name) VALUES
  ('supermotocross', 'SuperMotocross')
ON CONFLICT (username) DO NOTHING;
