-- P3-1: Additional Performance Indexes
-- Add composite indexes for common query patterns

-- Composite index for ai_jobs queries by user and course
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_course 
ON public.ai_jobs(user_id, course_id);

-- Index for subscriptions stripe lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer 
ON public.subscriptions(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Index for course_files extraction status filtering
CREATE INDEX IF NOT EXISTS idx_course_files_extraction_status 
ON public.course_files(extraction_status);

-- Index for study_plan_items user and completion status
CREATE INDEX IF NOT EXISTS idx_study_plan_items_user_completed 
ON public.study_plan_items(user_id, is_completed);
