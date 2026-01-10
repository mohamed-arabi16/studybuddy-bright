-- Add is_review column to study_plan_items
ALTER TABLE study_plan_items 
ADD COLUMN IF NOT EXISTS is_review BOOLEAN DEFAULT false;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_study_plan_items_is_review 
ON study_plan_items (is_review) WHERE is_review = true;