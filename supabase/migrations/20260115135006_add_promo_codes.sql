-- Migration: Add promo codes system for pre-launch trial promotions
-- Enables admins to create limited-time promo codes for Pro trial access

-- Table for promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  trial_days INTEGER NOT NULL DEFAULT 7,
  max_redemptions INTEGER NOT NULL DEFAULT 10,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for tracking promo code redemptions
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end_date TIMESTAMPTZ NOT NULL,
  UNIQUE(promo_code_id, user_id)
);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with promo_codes
CREATE POLICY "Admins can manage promo codes"
  ON promo_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Any authenticated user can view active promo codes (for validation)
CREATE POLICY "Users can view active promo codes"
  ON promo_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON promo_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own redemptions
CREATE POLICY "Users can redeem codes"
  ON promo_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all redemptions
CREATE POLICY "Admins can view all redemptions"
  ON promo_redemptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Function to validate and redeem a promo code
CREATE OR REPLACE FUNCTION redeem_promo_code(p_code VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_user_id UUID;
  v_trial_end TIMESTAMPTZ;
  v_existing_redemption promo_redemptions%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true;

  IF v_promo.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive promo code');
  END IF;

  -- Check if expired
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'This promo code has expired');
  END IF;

  -- Check if max redemptions reached
  IF v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN json_build_object('success', false, 'error', 'This promo code has reached its maximum redemptions');
  END IF;

  -- Check if user already redeemed this code
  SELECT * INTO v_existing_redemption
  FROM promo_redemptions
  WHERE promo_code_id = v_promo.id
    AND user_id = v_user_id;

  IF v_existing_redemption.id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  -- Calculate trial end date
  v_trial_end := now() + (v_promo.trial_days || ' days')::INTERVAL;

  -- Create redemption record
  INSERT INTO promo_redemptions (promo_code_id, user_id, trial_end_date)
  VALUES (v_promo.id, v_user_id, v_trial_end);

  -- Increment redemption counter
  UPDATE promo_codes
  SET current_redemptions = current_redemptions + 1,
      updated_at = now()
  WHERE id = v_promo.id;

  -- Create/update admin_override to grant trial access
  INSERT INTO admin_overrides (user_id, trial_extension_days, notes, created_by, updated_at)
  VALUES (
    v_user_id,
    v_promo.trial_days,
    'Promo code: ' || v_promo.code,
    v_promo.created_by,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    trial_extension_days = GREATEST(
      COALESCE(admin_overrides.trial_extension_days, 0),
      v_promo.trial_days
    ),
    notes = COALESCE(admin_overrides.notes, '') || ' | Promo: ' || v_promo.code,
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'trial_days', v_promo.trial_days,
    'trial_end_date', v_trial_end,
    'message', 'Promo code redeemed successfully! You now have Pro access for ' || v_promo.trial_days || ' days.'
  );
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(promo_code_id);
