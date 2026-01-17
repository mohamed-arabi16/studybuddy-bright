-- Fix security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS admin_refund_eligibility;

CREATE VIEW admin_refund_eligibility 
WITH (security_invoker = true)
AS
SELECT 
  su.id,
  su.user_id,
  p.email,
  p.display_name,
  p.full_name,
  s.id as subscription_id,
  s.status as subscription_status,
  s.created_at as subscription_started,
  pl.name as plan_name,
  
  -- Refund Window Check (7 days from subscription start)
  s.created_at + INTERVAL '7 days' as refund_window_expires,
  CASE WHEN now() <= s.created_at + INTERVAL '7 days' THEN true ELSE false END as within_refund_window,
  EXTRACT(DAY FROM (s.created_at + INTERVAL '7 days') - now()) as days_remaining,
  
  -- First Purchase Check
  su.is_first_pro_purchase,
  
  -- Material Use Counters
  su.syllabus_extractions_count,
  su.past_exam_analyses_completed,
  su.quizzes_generated_count,
  su.topic_deepdives_count,
  su.calendar_events_synced_count,
  su.pro_courses_created_count,
  su.exports_count,
  
  -- Limit Exceeded Flags
  su.syllabus_extractions_count > 2 as syllabus_limit_exceeded,
  su.past_exam_analyses_completed > 0 as past_exam_limit_exceeded,
  su.quizzes_generated_count > 25 as quizzes_limit_exceeded,
  su.topic_deepdives_count > 10 as deepdives_limit_exceeded,
  su.calendar_events_synced_count > 14 as calendar_limit_exceeded,
  su.pro_courses_created_count > 2 as courses_limit_exceeded,
  su.exports_count > 0 as exports_limit_exceeded,
  
  -- Overall Eligibility
  CASE 
    WHEN su.refund_approved_at IS NOT NULL THEN false
    WHEN su.refund_denied_at IS NOT NULL THEN false
    WHEN now() > s.created_at + INTERVAL '7 days' THEN false
    WHEN NOT su.is_first_pro_purchase THEN false
    WHEN su.syllabus_extractions_count > 2 THEN false
    WHEN su.past_exam_analyses_completed > 0 THEN false
    WHEN su.quizzes_generated_count > 25 THEN false
    WHEN su.topic_deepdives_count > 10 THEN false
    WHEN su.calendar_events_synced_count > 14 THEN false
    WHEN su.pro_courses_created_count > 2 THEN false
    WHEN su.exports_count > 0 THEN false
    ELSE true 
  END as is_refund_eligible,
  
  -- Refund Status
  su.refund_requested_at,
  su.refund_approved_at,
  su.refund_denied_at,
  su.refund_denial_reason,
  su.created_at as usage_tracking_started,
  su.updated_at as last_activity
  
FROM subscription_usage su
JOIN profiles p ON p.user_id = su.user_id
JOIN subscriptions s ON s.id = su.subscription_id
LEFT JOIN plans pl ON s.plan_id = pl.id
WHERE s.status IN ('active', 'trialing')
ORDER BY s.created_at DESC;