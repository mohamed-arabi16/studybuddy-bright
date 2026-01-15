-- Add explanation fields to study_plan_items for "Why this date?" tooltip
ALTER TABLE public.study_plan_items
  ADD COLUMN IF NOT EXISTS reason_codes text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS explanation_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prereq_topic_ids text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exam_proximity_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS load_balance_note text DEFAULT NULL;