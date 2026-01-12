-- P0-4: Token Encryption Migration
-- Add encrypted token columns to google_calendar_connections for secure storage
-- This migrates from plaintext to encrypted OAuth tokens

-- Add encrypted token columns
ALTER TABLE public.google_calendar_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS encryption_key_id TEXT;

-- Add comment explaining the columns
COMMENT ON COLUMN public.google_calendar_connections.encrypted_access_token IS 'AES-256-GCM encrypted access token. Encryption key stored in environment.';
COMMENT ON COLUMN public.google_calendar_connections.encrypted_refresh_token IS 'AES-256-GCM encrypted refresh token. Encryption key stored in environment.';
COMMENT ON COLUMN public.google_calendar_connections.encryption_version IS 'Version of encryption scheme used. Allows for key rotation.';
COMMENT ON COLUMN public.google_calendar_connections.encryption_key_id IS 'Identifier for the encryption key used (for key rotation support).';

-- Note: The actual encryption will be handled by the Edge Functions
-- The plaintext columns (access_token, refresh_token) should be deprecated
-- and will be migrated to encrypted versions by the application layer

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_encryption_version 
ON public.google_calendar_connections(encryption_version) 
WHERE encrypted_access_token IS NOT NULL;
