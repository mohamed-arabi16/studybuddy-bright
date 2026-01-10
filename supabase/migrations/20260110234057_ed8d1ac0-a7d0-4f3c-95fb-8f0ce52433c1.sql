-- Allow users to read their own override (for subscription display)
CREATE POLICY "Users can read own override"
ON public.admin_overrides
FOR SELECT
TO authenticated
USING (user_id = auth.uid());