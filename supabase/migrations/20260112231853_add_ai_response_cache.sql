-- P3-3: AI Response Cache Table
-- Implements caching for AI API responses to reduce costs and improve performance

-- Create the ai_response_cache table
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    input_hash TEXT NOT NULL,
    cache_type TEXT NOT NULL DEFAULT 'extract_topics',
    response_json JSONB NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT ai_response_cache_cache_type_check 
        CHECK (cache_type IN ('extract_topics', 'ocr', 'parse_pdf', 'general')),
    CONSTRAINT ai_response_cache_unique_hash_type
        UNIQUE (input_hash, cache_type)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash_type 
ON public.ai_response_cache(input_hash, cache_type);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires 
ON public.ai_response_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_cache_created 
ON public.ai_response_cache(created_at);

-- Enable RLS
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Cache is managed by service role only (Edge Functions)
-- No user-level access needed as cache is shared across users
CREATE POLICY "Service role can manage cache" 
ON public.ai_response_cache
USING (true)
WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.ai_response_cache IS 'Caches AI API responses to reduce costs. Entries expire based on cache_type.';
COMMENT ON COLUMN public.ai_response_cache.input_hash IS 'SHA-256 hash of the input text (truncated).';
COMMENT ON COLUMN public.ai_response_cache.cache_type IS 'Type of cached response for partitioning.';
COMMENT ON COLUMN public.ai_response_cache.hit_count IS 'Number of times this cache entry has been used.';

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_ai_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.ai_response_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_ai_cache IS 'Removes expired cache entries. Should be called periodically via cron.';
