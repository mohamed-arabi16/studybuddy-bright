-- Add extraction metadata columns to course_files
ALTER TABLE public.course_files 
ADD COLUMN IF NOT EXISTS extraction_method TEXT,
ADD COLUMN IF NOT EXISTS pages_processed INTEGER,
ADD COLUMN IF NOT EXISTS extraction_quality TEXT,
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';

-- Add check constraint for extraction_quality
ALTER TABLE public.course_files DROP CONSTRAINT IF EXISTS course_files_extraction_quality_check;
ALTER TABLE public.course_files ADD CONSTRAINT course_files_extraction_quality_check 
  CHECK (extraction_quality IS NULL OR extraction_quality IN ('high', 'medium', 'low', 'failed'));

-- Update extraction_status to include new statuses
-- First check what values exist
-- Note: We're being permissive here since there's no constraint currently