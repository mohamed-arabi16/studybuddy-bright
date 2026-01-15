-- ============= PHASE 1 SECURITY FIXES =============
-- Migration: Create is_user_enabled function, audit_logs table, webhook_events table, and audit triggers

-- ============= 1. IS_USER_ENABLED FUNCTION =============
-- Helper function to check if a user is NOT disabled (for RLS policies)
CREATE OR REPLACE FUNCTION public.is_user_enabled(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE(
    (SELECT is_disabled FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- ============= 2. AUDIT_LOGS TABLE =============
-- Append-only audit log for admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL DEFAULT 'user',
  target_user_id uuid,
  action_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  request_id text
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- RLS: Only admins can read, no client writes allowed
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= 3. WEBHOOK_EVENTS TABLE (Stripe Idempotency) =============
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for quick duplicate lookup
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- RLS: No client access (service role only)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies = no client access, only service role can access

-- ============= 4. AUDIT TRIGGER FUNCTIONS =============

-- Trigger for admin_overrides changes
CREATE OR REPLACE FUNCTION public.audit_admin_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, actor_role, target_user_id, action_type, metadata)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'admin',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'GRANT_OVERRIDE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE_OVERRIDE'
      WHEN TG_OP = 'DELETE' THEN 'REVOKE_OVERRIDE'
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', 'admin_overrides',
      'old_values', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_overrides ON admin_overrides;
CREATE TRIGGER trg_audit_admin_overrides
  AFTER INSERT OR UPDATE OR DELETE ON admin_overrides
  FOR EACH ROW EXECUTE FUNCTION audit_admin_overrides();

-- Trigger for user_roles changes
CREATE OR REPLACE FUNCTION public.audit_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, actor_role, target_user_id, action_type, metadata)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'admin',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'GRANT_ROLE'
      WHEN TG_OP = 'DELETE' THEN 'REVOKE_ROLE'
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', 'user_roles',
      'role', COALESCE(NEW.role, OLD.role)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_user_roles();

-- Trigger for promo_codes changes
CREATE OR REPLACE FUNCTION public.audit_promo_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, actor_role, target_user_id, action_type, metadata)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'admin',
    NULL,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'CREATE_PROMO'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE_PROMO'
      WHEN TG_OP = 'DELETE' THEN 'DELETE_PROMO'
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', 'promo_codes',
      'code', COALESCE(NEW.code, OLD.code),
      'old_values', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_promo_codes ON promo_codes;
CREATE TRIGGER trg_audit_promo_codes
  AFTER INSERT OR UPDATE OR DELETE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION audit_promo_codes();

-- Trigger for profiles.is_disabled changes
CREATE OR REPLACE FUNCTION public.audit_user_disabled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if is_disabled actually changed
  IF OLD.is_disabled IS DISTINCT FROM NEW.is_disabled THEN
    INSERT INTO audit_logs (actor_id, actor_role, target_user_id, action_type, metadata)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'admin',
      NEW.user_id,
      CASE 
        WHEN NEW.is_disabled = true THEN 'DISABLE_USER'
        ELSE 'ENABLE_USER'
      END,
      jsonb_build_object(
        'operation', 'UPDATE',
        'table_name', 'profiles',
        'old_is_disabled', OLD.is_disabled,
        'new_is_disabled', NEW.is_disabled
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_disabled ON profiles;
CREATE TRIGGER trg_audit_user_disabled
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_user_disabled();