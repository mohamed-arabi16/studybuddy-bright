-- Trigger function to sync credits when admin grants override
CREATE OR REPLACE FUNCTION public.sync_credits_on_admin_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowance integer;
  v_credit_override integer;
  v_credit_allowance integer;
BEGIN
  -- Check if this is a Pro grant (has quota_overrides with credit settings or courses=-1)
  IF NEW.quota_overrides IS NOT NULL THEN
    -- Check for explicit credit_balance override (new system)
    v_credit_override := (NEW.quota_overrides->>'credit_balance')::integer;
    v_credit_allowance := (NEW.quota_overrides->>'credit_allowance')::integer;
    
    IF v_credit_override IS NOT NULL OR v_credit_allowance IS NOT NULL THEN
      -- Direct credit balance/allowance override
      INSERT INTO user_credits (user_id, balance, monthly_allowance, plan_tier, last_reset_date)
      VALUES (
        NEW.user_id, 
        COALESCE(v_credit_override, 1500), 
        COALESCE(v_credit_allowance, v_credit_override, 1500), 
        'pro', 
        date_trunc('month', now())
      )
      ON CONFLICT (user_id) DO UPDATE SET
        balance = COALESCE(v_credit_override, user_credits.balance),
        monthly_allowance = COALESCE(v_credit_allowance, v_credit_override, user_credits.monthly_allowance),
        plan_tier = 'pro',
        updated_at = now();
    ELSIF (NEW.quota_overrides->>'courses')::integer = -1 THEN
      -- Pro grant detected (unlimited courses = Pro)
      SELECT monthly_allowance INTO v_allowance
      FROM credit_plans WHERE tier = 'pro' AND is_active = true;
      
      IF v_allowance IS NULL THEN v_allowance := 1500; END IF;
      
      INSERT INTO user_credits (user_id, balance, monthly_allowance, plan_tier, last_reset_date)
      VALUES (NEW.user_id, v_allowance, v_allowance, 'pro', date_trunc('month', now()))
      ON CONFLICT (user_id) DO UPDATE SET
        balance = GREATEST(user_credits.balance, v_allowance),
        monthly_allowance = v_allowance,
        plan_tier = 'pro',
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for admin_overrides -> user_credits sync
DROP TRIGGER IF EXISTS trg_sync_credits_on_admin_override ON public.admin_overrides;
CREATE TRIGGER trg_sync_credits_on_admin_override
  AFTER INSERT OR UPDATE ON public.admin_overrides
  FOR EACH ROW EXECUTE FUNCTION public.sync_credits_on_admin_override();