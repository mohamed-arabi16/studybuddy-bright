-- =============================================
-- Subscription Usage Tracking for Refund Eligibility
-- =============================================

-- Create subscription_usage table to track per-period usage
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ,
  
  -- Material Use Counters (from Refund Policy Section 4.1)
  syllabus_extractions_count INTEGER NOT NULL DEFAULT 0,
  past_exam_analyses_completed INTEGER NOT NULL DEFAULT 0,
  quizzes_generated_count INTEGER NOT NULL DEFAULT 0,
  topic_deepdives_count INTEGER NOT NULL DEFAULT 0,
  calendar_events_synced_count INTEGER NOT NULL DEFAULT 0,
  pro_courses_created_count INTEGER NOT NULL DEFAULT 0,
  exports_count INTEGER NOT NULL DEFAULT 0,
  
  -- Refund Eligibility Tracking
  is_first_pro_purchase BOOLEAN NOT NULL DEFAULT true,
  refund_requested_at TIMESTAMPTZ,
  refund_approved_at TIMESTAMPTZ,
  refund_denied_at TIMESTAMPTZ,
  refund_denial_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, subscription_id)
);

-- Enable RLS
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage subscription usage"
  ON subscription_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own subscription usage"
  ON subscription_usage FOR SELECT
  USING (user_id = auth.uid() AND is_user_enabled(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_subscription_usage_user_period 
  ON subscription_usage(user_id, period_start DESC);

CREATE INDEX idx_subscription_usage_subscription
  ON subscription_usage(subscription_id);

-- Trigger for updated_at
CREATE TRIGGER update_subscription_usage_updated_at
  BEFORE UPDATE ON subscription_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Function to Increment Usage Counters
-- =============================================

CREATE OR REPLACE FUNCTION increment_subscription_usage(
  p_user_id UUID,
  p_counter_name TEXT,
  p_increment_by INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Get active subscription
  SELECT id INTO v_subscription_id 
  FROM subscriptions 
  WHERE user_id = p_user_id AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Create usage record if not exists
  INSERT INTO subscription_usage (user_id, subscription_id, period_start)
  VALUES (p_user_id, v_subscription_id, now())
  ON CONFLICT (user_id, subscription_id) DO NOTHING;
  
  -- Increment the appropriate counter using dynamic SQL
  CASE p_counter_name
    WHEN 'syllabus_extractions_count' THEN
      UPDATE subscription_usage 
      SET syllabus_extractions_count = syllabus_extractions_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'past_exam_analyses_completed' THEN
      UPDATE subscription_usage 
      SET past_exam_analyses_completed = past_exam_analyses_completed + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'quizzes_generated_count' THEN
      UPDATE subscription_usage 
      SET quizzes_generated_count = quizzes_generated_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'topic_deepdives_count' THEN
      UPDATE subscription_usage 
      SET topic_deepdives_count = topic_deepdives_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'calendar_events_synced_count' THEN
      UPDATE subscription_usage 
      SET calendar_events_synced_count = calendar_events_synced_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'pro_courses_created_count' THEN
      UPDATE subscription_usage 
      SET pro_courses_created_count = pro_courses_created_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
    WHEN 'exports_count' THEN
      UPDATE subscription_usage 
      SET exports_count = exports_count + p_increment_by, updated_at = now()
      WHERE user_id = p_user_id AND (subscription_id = v_subscription_id OR (subscription_id IS NULL AND v_subscription_id IS NULL));
  END CASE;
END;
$$;

-- =============================================
-- Trigger to Track Pro Course Creation
-- =============================================

CREATE OR REPLACE FUNCTION track_pro_course_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_limit INTEGER;
  v_current_count INTEGER;
  v_has_pro BOOLEAN;
BEGIN
  -- Check if user has active Pro subscription
  SELECT EXISTS(
    SELECT 1 FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = NEW.user_id 
    AND s.status IN ('active', 'trialing')
    AND p.name ILIKE '%pro%'
  ) INTO v_has_pro;
  
  -- Only track if user has Pro
  IF v_has_pro THEN
    -- Get free tier course limit (default 3)
    SELECT COALESCE((limits->>'courses')::INTEGER, 3) INTO v_free_limit
    FROM plans WHERE LOWER(name) = 'free' LIMIT 1;
    
    IF v_free_limit IS NULL THEN
      v_free_limit := 3;
    END IF;
    
    -- Get current course count (before this insert)
    SELECT COUNT(*) INTO v_current_count
    FROM courses WHERE user_id = NEW.user_id AND id != NEW.id;
    
    -- If this exceeds free tier, increment pro courses counter
    IF v_current_count >= v_free_limit THEN
      PERFORM increment_subscription_usage(
        NEW.user_id,
        'pro_courses_created_count',
        1
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_pro_courses_trigger ON courses;
CREATE TRIGGER track_pro_courses_trigger
  AFTER INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION track_pro_course_creation();

-- =============================================
-- Admin View for Refund Eligibility
-- =============================================

CREATE OR REPLACE VIEW admin_refund_eligibility AS
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

-- Grant access to view for admins (view inherits from base table RLS)