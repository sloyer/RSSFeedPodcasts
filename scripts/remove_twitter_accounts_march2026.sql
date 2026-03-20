-- Remove 4 Twitter accounts (March 2026)
-- Tweets cascade delete via the foreign key ON DELETE CASCADE

DELETE FROM twitter_accounts
WHERE username IN (
  'DnxShow',
  'Dirtbike_Lovers',
  'Josh_Wahlers',
  'MattBurkeen820'
);
