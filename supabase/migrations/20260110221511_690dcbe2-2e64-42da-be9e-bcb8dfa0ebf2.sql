-- Remove the overly permissive INSERT policy - service role bypasses RLS anyway
DROP POLICY IF EXISTS "Service role can insert usage analytics" ON public.usage_analytics;