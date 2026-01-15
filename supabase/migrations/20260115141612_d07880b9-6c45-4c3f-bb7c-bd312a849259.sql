-- Create promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  trial_days INTEGER NOT NULL DEFAULT 7,
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promo_redemptions table
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_days_granted INTEGER NOT NULL,
  UNIQUE(promo_code_id, user_id)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for promo_codes
CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS policies for promo_redemptions
CREATE POLICY "Admins can view all redemptions"
  ON public.promo_redemptions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own redemptions"
  ON public.promo_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own redemptions"
  ON public.promo_redemptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON public.promo_redemptions(promo_code_id);

-- Create redeem_promo_code function
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_promo promo_codes%ROWTYPE;
  v_existing_redemption UUID;
  v_subscription subscriptions%ROWTYPE;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF v_promo.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check max redemptions
  IF v_promo.max_redemptions IS NOT NULL AND v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has reached its maximum uses');
  END IF;

  -- Check if user already redeemed this code
  SELECT id INTO v_existing_redemption
  FROM promo_redemptions
  WHERE promo_code_id = v_promo.id AND user_id = v_user_id;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;

  -- Get user's subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    -- Create subscription with trial
    INSERT INTO subscriptions (user_id, status, trial_start, trial_end)
    VALUES (v_user_id, 'trialing', now(), now() + (v_promo.trial_days || ' days')::interval);
  ELSE
    -- Extend trial
    UPDATE subscriptions
    SET 
      trial_end = GREATEST(COALESCE(trial_end, now()), now()) + (v_promo.trial_days || ' days')::interval,
      status = CASE WHEN status = 'expired' THEN 'trialing' ELSE status END,
      updated_at = now()
    WHERE id = v_subscription.id;
  END IF;

  -- Record redemption
  INSERT INTO promo_redemptions (promo_code_id, user_id, trial_days_granted)
  VALUES (v_promo.id, v_user_id, v_promo.trial_days);

  -- Increment redemption count
  UPDATE promo_codes
  SET current_redemptions = current_redemptions + 1, updated_at = now()
  WHERE id = v_promo.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Promo code redeemed successfully! ' || v_promo.trial_days || ' days added to your trial.',
    'trial_days', v_promo.trial_days
  );
END;
$$;