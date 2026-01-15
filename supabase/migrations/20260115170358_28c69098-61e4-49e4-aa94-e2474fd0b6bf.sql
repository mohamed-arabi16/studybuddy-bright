-- =============================================
-- PHASE 2: FAIR USE CREDIT SYSTEM
-- =============================================

-- 1. Create user_credits table
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  monthly_allowance integer NOT NULL DEFAULT 50,
  last_reset_date timestamptz NOT NULL DEFAULT now(),
  plan_tier text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key separately to avoid issues with profiles table
ALTER TABLE public.user_credits 
  ADD CONSTRAINT user_credits_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- RLS for user_credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Admins can read all credits"
  ON public.user_credits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update credits"
  ON public.user_credits FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for quick lookups
CREATE INDEX idx_user_credits_reset_date ON public.user_credits(last_reset_date);

-- 2. Create credit_plans table (DB-driven configuration)
CREATE TABLE public.credit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text UNIQUE NOT NULL,
  monthly_allowance integer NOT NULL,
  reset_rule text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed credit plans
INSERT INTO public.credit_plans (tier, monthly_allowance, reset_rule) VALUES
  ('free', 50, 'monthly'),
  ('trial', 1500, 'monthly'),
  ('pro', 1500, 'monthly');

-- RLS for credit_plans
ALTER TABLE public.credit_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read credit plans"
  ON public.credit_plans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage credit plans"
  ON public.credit_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Create credit_costs table
CREATE TABLE public.credit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text UNIQUE NOT NULL,
  cost_credits integer NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed credit costs
INSERT INTO public.credit_costs (action_type, cost_credits, description) VALUES
  ('extract_topics', 30, 'AI topic extraction from syllabus/PDF'),
  ('generate_plan', 15, 'AI-powered study plan generation'),
  ('analyze_topic', 5, 'Single topic difficulty analysis'),
  ('chat_with_tutor', 2, 'AI tutor message (future)');

-- RLS for credit_costs
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read credit costs"
  ON public.credit_costs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage credit costs"
  ON public.credit_costs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Create credit_usage_events table (instrumentation)
CREATE TABLE public.credit_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  action_type text NOT NULL,
  credits_charged integer NOT NULL,
  job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  model text DEFAULT 'google/gemini-2.5-flash',
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  provider_response_metadata jsonb,
  computed_cost_usd numeric(10,6),
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL
);

-- Add foreign key for user_id
ALTER TABLE public.credit_usage_events 
  ADD CONSTRAINT credit_usage_events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- RLS for credit_usage_events
ALTER TABLE public.credit_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage events"
  ON public.credit_usage_events FOR SELECT
  USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Admins can read all usage events"
  ON public.credit_usage_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Indexes for analytics
CREATE INDEX idx_credit_usage_events_user_id ON public.credit_usage_events(user_id);
CREATE INDEX idx_credit_usage_events_created_at ON public.credit_usage_events(created_at DESC);
CREATE INDEX idx_credit_usage_events_action_type ON public.credit_usage_events(action_type);

-- 5. Create consume_credits atomic function
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_job_id uuid DEFAULT NULL,
  p_course_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_monthly_allowance integer;
  v_last_reset timestamptz;
  v_plan_tier text;
  v_new_balance integer;
  v_needs_reset boolean;
  v_event_id uuid;
BEGIN
  -- Lock the user's credit row for atomic update
  SELECT balance, monthly_allowance, last_reset_date, plan_tier
  INTO v_current_balance, v_monthly_allowance, v_last_reset, v_plan_tier
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no credit record exists, create one based on user's plan
  IF NOT FOUND THEN
    -- Determine plan tier from subscription
    SELECT 
      CASE 
        WHEN s.status = 'trialing' AND (s.trial_end IS NULL OR s.trial_end > now()) THEN 'trial'
        WHEN s.status = 'active' AND p.name ILIKE '%pro%' THEN 'pro'
        ELSE 'free'
      END INTO v_plan_tier
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id;

    IF v_plan_tier IS NULL THEN
      v_plan_tier := 'free';
    END IF;

    -- Get allowance from credit_plans
    SELECT monthly_allowance INTO v_monthly_allowance
    FROM credit_plans WHERE tier = v_plan_tier AND is_active = true;

    IF v_monthly_allowance IS NULL THEN
      v_monthly_allowance := 50; -- Fallback
    END IF;

    INSERT INTO user_credits (user_id, balance, monthly_allowance, plan_tier, last_reset_date)
    VALUES (p_user_id, v_monthly_allowance, v_monthly_allowance, v_plan_tier, date_trunc('month', now()))
    RETURNING balance, monthly_allowance, last_reset_date, plan_tier
    INTO v_current_balance, v_monthly_allowance, v_last_reset, v_plan_tier;
  END IF;

  -- Check if monthly reset is needed
  v_needs_reset := date_trunc('month', now()) > date_trunc('month', v_last_reset);

  IF v_needs_reset THEN
    -- Refresh plan tier and allowance from current subscription
    SELECT 
      CASE 
        WHEN s.status = 'trialing' AND (s.trial_end IS NULL OR s.trial_end > now()) THEN 'trial'
        WHEN s.status = 'active' AND p.name ILIKE '%pro%' THEN 'pro'
        ELSE 'free'
      END INTO v_plan_tier
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id;

    IF v_plan_tier IS NULL THEN
      v_plan_tier := 'free';
    END IF;

    SELECT monthly_allowance INTO v_monthly_allowance
    FROM credit_plans WHERE tier = v_plan_tier AND is_active = true;

    IF v_monthly_allowance IS NULL THEN
      v_monthly_allowance := 50;
    END IF;

    -- Reset balance
    v_current_balance := v_monthly_allowance;

    UPDATE user_credits
    SET balance = v_monthly_allowance,
        monthly_allowance = v_monthly_allowance,
        plan_tier = v_plan_tier,
        last_reset_date = date_trunc('month', now()),
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CREDITS',
      'balance', v_current_balance,
      'required', p_amount,
      'plan_tier', v_plan_tier,
      'monthly_allowance', v_monthly_allowance
    );
  END IF;

  -- Deduct credits atomically
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_credits
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log usage event and get its ID
  INSERT INTO credit_usage_events (user_id, action_type, credits_charged, job_id, course_id)
  VALUES (p_user_id, p_action, p_amount, p_job_id, p_course_id)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', p_amount,
    'new_balance', v_new_balance,
    'monthly_allowance', v_monthly_allowance,
    'plan_tier', v_plan_tier,
    'event_id', v_event_id
  );
END;
$$;

-- 6. Create function to update token usage after AI call
CREATE OR REPLACE FUNCTION public.update_credit_usage_tokens(
  p_event_id uuid,
  p_tokens_in integer,
  p_tokens_out integer,
  p_latency_ms integer,
  p_model text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credit_usage_events
  SET 
    tokens_in = p_tokens_in,
    tokens_out = p_tokens_out,
    latency_ms = p_latency_ms,
    model = COALESCE(p_model, model),
    provider_response_metadata = p_metadata
  WHERE id = p_event_id;
END;
$$;

-- 7. Create trigger to sync credits on subscription change
CREATE OR REPLACE FUNCTION public.sync_credits_on_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_allowance integer;
  v_current_balance integer;
BEGIN
  -- Determine new tier based on subscription status and plan
  SELECT 
    CASE 
      WHEN NEW.status = 'trialing' AND (NEW.trial_end IS NULL OR NEW.trial_end > now()) THEN 'trial'
      WHEN NEW.status = 'active' AND p.name ILIKE '%pro%' THEN 'pro'
      ELSE 'free'
    END INTO v_tier
  FROM plans p WHERE p.id = NEW.plan_id;

  IF v_tier IS NULL THEN 
    v_tier := 'free'; 
  END IF;

  -- Get allowance from credit_plans
  SELECT monthly_allowance INTO v_allowance
  FROM credit_plans WHERE tier = v_tier AND is_active = true;

  IF v_allowance IS NULL THEN 
    v_allowance := 50; 
  END IF;

  -- Get current balance if exists
  SELECT balance INTO v_current_balance
  FROM user_credits WHERE user_id = NEW.user_id;

  -- Upsert user_credits
  INSERT INTO user_credits (user_id, balance, monthly_allowance, plan_tier, last_reset_date)
  VALUES (NEW.user_id, v_allowance, v_allowance, v_tier, date_trunc('month', now()))
  ON CONFLICT (user_id) DO UPDATE SET
    plan_tier = v_tier,
    monthly_allowance = v_allowance,
    -- If upgrading, give the higher of current balance or new allowance
    balance = CASE 
      WHEN v_tier != user_credits.plan_tier AND v_allowance > user_credits.monthly_allowance 
        THEN GREATEST(user_credits.balance, v_allowance)
      ELSE user_credits.balance
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_credits_on_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_credits_on_subscription
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_credits_on_subscription_change();

-- 8. Create analytics views for admin
CREATE OR REPLACE VIEW public.admin_credit_analytics AS
SELECT 
  action_type,
  COUNT(*) as total_events,
  SUM(credits_charged) as total_credits,
  AVG(tokens_in) as avg_tokens_in,
  AVG(tokens_out) as avg_tokens_out,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)) as median_total_tokens,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)) as p95_total_tokens,
  AVG(latency_ms) as avg_latency_ms,
  SUM(computed_cost_usd) as total_cost_usd
FROM credit_usage_events
WHERE created_at > now() - interval '30 days'
GROUP BY action_type;

CREATE OR REPLACE VIEW public.admin_full_course_cost AS
SELECT 
  course_id,
  COUNT(*) FILTER (WHERE action_type = 'extract_topics') as extract_count,
  COUNT(*) FILTER (WHERE action_type = 'generate_plan') as plan_count,
  SUM(credits_charged) as total_credits,
  SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)) as total_tokens,
  SUM(computed_cost_usd) as total_cost_usd
FROM credit_usage_events
WHERE course_id IS NOT NULL
GROUP BY course_id;