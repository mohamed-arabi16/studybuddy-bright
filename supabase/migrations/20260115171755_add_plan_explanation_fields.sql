-- =============================================
-- PHASE 3: PLAN CREDIBILITY & EXPLAINABLE PLAN UX
-- Add explanation fields to study_plan_items
-- =============================================

-- Add explanation fields to study_plan_items table
-- These fields store deterministic explanations for "Why this date?"
ALTER TABLE public.study_plan_items
  ADD COLUMN IF NOT EXISTS reason_codes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS explanation_text text,
  ADD COLUMN IF NOT EXISTS prereq_topic_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exam_proximity_days integer,
  ADD COLUMN IF NOT EXISTS load_balance_note text;

-- Add index for efficient lookups when fetching explanations
CREATE INDEX IF NOT EXISTS idx_study_plan_items_prereq_topic_ids 
ON public.study_plan_items USING gin (prereq_topic_ids);

-- Add comments for documentation
COMMENT ON COLUMN public.study_plan_items.reason_codes IS 'Array of reason codes explaining why this item was scheduled (e.g., prereq_unlocked, exam_proximity, load_balance)';
COMMENT ON COLUMN public.study_plan_items.explanation_text IS 'Human-readable explanation text for "Why this date?" tooltip';
COMMENT ON COLUMN public.study_plan_items.prereq_topic_ids IS 'Array of topic IDs that are prerequisites for this topic and must be completed first';
COMMENT ON COLUMN public.study_plan_items.exam_proximity_days IS 'Number of days until the course exam when this item was scheduled';
COMMENT ON COLUMN public.study_plan_items.load_balance_note IS 'Note about load balancing decisions (e.g., "Scheduled earlier to balance daily workload")';

-- Add topics_snapshot_id to study_plan_days if not exists (may already exist from previous migration)
ALTER TABLE public.study_plan_days
  ADD COLUMN IF NOT EXISTS topics_snapshot_id uuid;

COMMENT ON COLUMN public.study_plan_days.topics_snapshot_id IS 'Snapshot ID linking to the topics version used to generate this plan day';
