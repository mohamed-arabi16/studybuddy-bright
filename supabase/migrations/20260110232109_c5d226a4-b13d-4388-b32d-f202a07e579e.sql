-- P0: Drop default from extraction_run_id (set only at extraction start)
ALTER TABLE public.course_files 
ALTER COLUMN extraction_run_id DROP DEFAULT;

-- P1: Add plan-level topic version tracking for staleness detection
ALTER TABLE public.study_plan_days
ADD COLUMN IF NOT EXISTS topics_snapshot_id UUID;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.study_plan_days.topics_snapshot_id IS 
  'Tracks the topic extraction run(s) used to generate this plan version for staleness detection';