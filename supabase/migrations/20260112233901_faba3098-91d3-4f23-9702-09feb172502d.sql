-- Create AI response cache table for caching LLM responses
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_hash text NOT NULL UNIQUE,
  model_name text NOT NULL,
  response_json jsonb NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days')
);

-- Add index for quick lookups by input_hash
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_hash ON public.ai_response_cache(input_hash);

-- Add index for cleaning expired entries
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires ON public.ai_response_cache(expires_at);

-- Enable RLS
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access cache (used by edge functions)
CREATE POLICY "Service role only" ON public.ai_response_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add comment
COMMENT ON TABLE public.ai_response_cache IS 'Cache for AI/LLM responses to reduce costs and latency';