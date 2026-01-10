-- 1. Create usage_analytics table for retaining data when users delete accounts
CREATE TABLE public.usage_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_hash text NOT NULL,
  total_courses integer DEFAULT 0,
  total_topics integer DEFAULT 0,
  total_ai_extractions integer DEFAULT 0,
  total_pomodoro_sessions integer DEFAULT 0,
  total_study_minutes integer DEFAULT 0,
  university text,
  department text,
  plan_at_deletion text,
  account_created_at timestamptz,
  account_deleted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: Only admins can read usage analytics
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view usage analytics"
  ON public.usage_analytics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert usage analytics"
  ON public.usage_analytics FOR INSERT
  WITH CHECK (true);

-- 2. Add full_name and profile_completed columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- 3. Update existing profiles to mark as completed if they have required fields
UPDATE public.profiles
SET profile_completed = true
WHERE university IS NOT NULL 
  AND university != ''
  AND department IS NOT NULL 
  AND department != ''
  AND (display_name IS NOT NULL OR full_name IS NOT NULL);

-- 4. Update handle_new_user trigger to include all metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    email, 
    display_name,
    full_name,
    department,
    university,
    phone_number,
    profile_completed,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'phone_number',
    CASE WHEN 
      NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND
      NEW.raw_user_meta_data->>'department' IS NOT NULL AND
      NEW.raw_user_meta_data->>'university' IS NOT NULL
    THEN true ELSE false END,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    department = COALESCE(EXCLUDED.department, profiles.department),
    university = COALESCE(EXCLUDED.university, profiles.university),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    profile_completed = CASE WHEN 
      COALESCE(EXCLUDED.full_name, profiles.full_name) IS NOT NULL AND
      COALESCE(EXCLUDED.department, profiles.department) IS NOT NULL AND
      COALESCE(EXCLUDED.university, profiles.university) IS NOT NULL
    THEN true ELSE false END,
    updated_at = now();
  RETURN NEW;
END;
$$;