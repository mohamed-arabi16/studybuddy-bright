-- Re-create the trigger that fires on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create missing profiles for existing users
INSERT INTO public.profiles (user_id, email, display_name, profile_completed, created_at, updated_at)
SELECT 
  id,
  email,
  split_part(email, '@', 1),
  false,
  now(),
  now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);