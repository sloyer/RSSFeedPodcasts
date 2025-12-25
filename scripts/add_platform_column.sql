-- Add platform column to push_tokens table

ALTER TABLE push_tokens 
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index for faster platform filtering
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);

-- Optional: Set existing tokens to unknown (they'll update when app registers next time)
UPDATE push_tokens 
SET platform = 'unknown' 
WHERE platform IS NULL;





