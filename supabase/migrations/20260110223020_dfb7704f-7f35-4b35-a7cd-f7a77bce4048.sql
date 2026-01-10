-- Add encrypted token columns to google_calendar_connections
ALTER TABLE public.google_calendar_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token text,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
ADD COLUMN IF NOT EXISTS encryption_version integer DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.google_calendar_connections.encrypted_access_token IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN public.google_calendar_connections.encrypted_refresh_token IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN public.google_calendar_connections.encryption_version IS 'Encryption key version for key rotation support';