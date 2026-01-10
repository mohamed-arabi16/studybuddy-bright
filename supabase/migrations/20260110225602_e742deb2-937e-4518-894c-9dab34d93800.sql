-- Add client_key column to topics table for stable insertion mapping
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS client_key TEXT;

-- Add index for faster lookups during prerequisite mapping
CREATE INDEX IF NOT EXISTS idx_topics_client_key ON public.topics(client_key);