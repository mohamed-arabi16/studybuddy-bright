-- Cross-Pipeline Hardening: Add extraction versioning and source tracking

-- Add extraction_run_id to course_files for tracking each extraction attempt
ALTER TABLE public.course_files 
ADD COLUMN IF NOT EXISTS extraction_run_id UUID DEFAULT gen_random_uuid();

-- Add source tracking to topics table
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.course_files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extraction_run_id UUID,
ADD COLUMN IF NOT EXISTS topic_key TEXT;

-- Add index for provenance queries on topics
CREATE INDEX IF NOT EXISTS idx_topics_source_file ON public.topics(source_file_id);
CREATE INDEX IF NOT EXISTS idx_topics_extraction_run ON public.topics(extraction_run_id);

-- Add topic_source_version to study_plan_items for plan invalidation detection
ALTER TABLE public.study_plan_items
ADD COLUMN IF NOT EXISTS topic_extraction_run_id UUID;

-- Create unique constraint for deduplication (prevent duplicate topics from same extraction)
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_unique_per_extraction 
ON public.topics(course_id, user_id, extraction_run_id, topic_key)
WHERE extraction_run_id IS NOT NULL AND topic_key IS NOT NULL;