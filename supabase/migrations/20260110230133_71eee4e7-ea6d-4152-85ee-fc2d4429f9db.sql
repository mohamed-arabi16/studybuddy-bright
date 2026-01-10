-- Update ai_jobs job_type constraint to include analyze_topic
ALTER TABLE public.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_job_type_check;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_job_type_check 
  CHECK (job_type = ANY (ARRAY[
    'extract_topics'::text, 
    'generate_plan'::text, 
    'analyze_topic'::text,
    'smart_plan'::text,
    'plan_generation'::text,
    'plan_regeneration'::text,
    'reschedule_plan'::text
  ]));