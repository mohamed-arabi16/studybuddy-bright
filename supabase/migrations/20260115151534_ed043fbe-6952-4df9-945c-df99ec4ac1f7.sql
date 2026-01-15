-- Drop and recreate redeem_promo_code function to set plan_id to Pro plan
DROP FUNCTION IF EXISTS public.redeem_promo_code(text);

CREATE FUNCTION public.redeem_promo_code(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_promo promo_codes%ROWTYPE;
  v_existing_redemption promo_redemptions%ROWTYPE;
  v_subscription subscriptions%ROWTYPE;
  v_pro_plan_id uuid;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the Pro plan ID
  SELECT id INTO v_pro_plan_id FROM plans WHERE LOWER(name) = 'pro' LIMIT 1;

  -- Find and lock the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF v_promo IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check max redemptions
  IF v_promo.max_redemptions IS NOT NULL AND v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN json_build_object('success', false, 'error', 'Promo code has reached maximum redemptions');
  END IF;

  -- Check if user already redeemed this code
  SELECT * INTO v_existing_redemption
  FROM promo_redemptions
  WHERE user_id = v_user_id AND promo_code_id = v_promo.id;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You have already redeemed this promo code');
  END IF;

  -- Get or create subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_subscription IS NULL THEN
    -- Create new subscription with Pro plan
    INSERT INTO subscriptions (user_id, status, plan_id, trial_start, trial_end)
    VALUES (
      v_user_id, 
      'trialing', 
      v_pro_plan_id,
      now(), 
      now() + (v_promo.trial_days || ' days')::interval
    )
    RETURNING * INTO v_subscription;
  ELSE
    -- Update existing subscription with Pro plan
    UPDATE subscriptions
    SET 
      plan_id = v_pro_plan_id,
      trial_end = GREATEST(COALESCE(trial_end, now()), now()) + (v_promo.trial_days || ' days')::interval,
      status = 'trialing',
      updated_at = now()
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;
  END IF;

  -- Record the redemption
  INSERT INTO promo_redemptions (user_id, promo_code_id, trial_days_granted)
  VALUES (v_user_id, v_promo.id, v_promo.trial_days);

  -- Increment redemption count
  UPDATE promo_codes
  SET current_redemptions = current_redemptions + 1, updated_at = now()
  WHERE id = v_promo.id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Promo code redeemed successfully!',
    'trial_days', v_promo.trial_days,
    'trial_end', v_subscription.trial_end
  );
END;
$$;

-- Fix existing subscriptions that were created via promo codes but don't have plan_id set
UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE LOWER(name) = 'pro' LIMIT 1)
FROM promo_redemptions pr
WHERE s.user_id = pr.user_id
  AND s.status = 'trialing'
  AND s.plan_id IS NULL;