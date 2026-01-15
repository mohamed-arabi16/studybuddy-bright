-- P0 Security: Add is_user_enabled check to all user-owned table RLS policies
-- This ensures disabled users cannot access any data

-- Drop existing policies and recreate with disabled check

-- ===================== COURSES =====================
DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
DROP POLICY IF EXISTS "Users can create their own courses" ON public.courses;
DROP POLICY IF EXISTS "Users can update their own courses" ON public.courses;
DROP POLICY IF EXISTS "Users can delete their own courses" ON public.courses;

CREATE POLICY "Users can view their own courses" ON public.courses
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own courses" ON public.courses
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own courses" ON public.courses
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete their own courses" ON public.courses
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== TOPICS =====================
DROP POLICY IF EXISTS "Users can view their own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can create their own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can delete their own topics" ON public.topics;

CREATE POLICY "Users can view their own topics" ON public.topics
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own topics" ON public.topics
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own topics" ON public.topics
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete their own topics" ON public.topics
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== COURSE_FILES =====================
DROP POLICY IF EXISTS "Users can view own course files" ON public.course_files;
DROP POLICY IF EXISTS "Users can create own course files" ON public.course_files;
DROP POLICY IF EXISTS "Users can update own course files" ON public.course_files;
DROP POLICY IF EXISTS "Users can delete own course files" ON public.course_files;

CREATE POLICY "Users can view own course files" ON public.course_files
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create own course files" ON public.course_files
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update own course files" ON public.course_files
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete own course files" ON public.course_files
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== STUDY_PLAN_DAYS =====================
DROP POLICY IF EXISTS "Users can view own plan days" ON public.study_plan_days;
DROP POLICY IF EXISTS "Users can create own plan days" ON public.study_plan_days;
DROP POLICY IF EXISTS "Users can update own plan days" ON public.study_plan_days;
DROP POLICY IF EXISTS "Users can delete own plan days" ON public.study_plan_days;

CREATE POLICY "Users can view own plan days" ON public.study_plan_days
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create own plan days" ON public.study_plan_days
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update own plan days" ON public.study_plan_days
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete own plan days" ON public.study_plan_days
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== STUDY_PLAN_ITEMS =====================
DROP POLICY IF EXISTS "Users can view own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can create own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can update own plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Users can delete own plan items" ON public.study_plan_items;

CREATE POLICY "Users can view own plan items" ON public.study_plan_items
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create own plan items" ON public.study_plan_items
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update own plan items" ON public.study_plan_items
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete own plan items" ON public.study_plan_items
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== AI_JOBS =====================
DROP POLICY IF EXISTS "Users can view own ai jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Users can create own ai jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Users can update own ai jobs" ON public.ai_jobs;

CREATE POLICY "Users can view own ai jobs" ON public.ai_jobs
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create own ai jobs" ON public.ai_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update own ai jobs" ON public.ai_jobs
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== FEEDBACK =====================
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;

CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== POMODORO_SESSIONS =====================
DROP POLICY IF EXISTS "Users can view their own pomodoro sessions" ON public.pomodoro_sessions;
DROP POLICY IF EXISTS "Users can create their own pomodoro sessions" ON public.pomodoro_sessions;

CREATE POLICY "Users can view their own pomodoro sessions" ON public.pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own pomodoro sessions" ON public.pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== GOOGLE_CALENDAR_CONNECTIONS =====================
DROP POLICY IF EXISTS "Users can view their own calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can create their own calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON public.google_calendar_connections;

CREATE POLICY "Users can view their own calendar connections" ON public.google_calendar_connections
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own calendar connections" ON public.google_calendar_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own calendar connections" ON public.google_calendar_connections
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete their own calendar connections" ON public.google_calendar_connections
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== ALLOCATIONS =====================
DROP POLICY IF EXISTS "Users can view their course allocations" ON public.allocations;
DROP POLICY IF EXISTS "Users can create allocations for their courses" ON public.allocations;
DROP POLICY IF EXISTS "Users can update allocations for their courses" ON public.allocations;
DROP POLICY IF EXISTS "Users can delete allocations for their courses" ON public.allocations;

CREATE POLICY "Users can view their course allocations" ON public.allocations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = allocations.course_id AND courses.user_id = auth.uid())
    AND public.is_user_enabled(auth.uid())
  );

CREATE POLICY "Users can create allocations for their courses" ON public.allocations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = allocations.course_id AND courses.user_id = auth.uid())
    AND public.is_user_enabled(auth.uid())
  );

CREATE POLICY "Users can update allocations for their courses" ON public.allocations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = allocations.course_id AND courses.user_id = auth.uid())
    AND public.is_user_enabled(auth.uid())
  );

CREATE POLICY "Users can delete allocations for their courses" ON public.allocations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = allocations.course_id AND courses.user_id = auth.uid())
    AND public.is_user_enabled(auth.uid())
  );

-- ===================== STUDY_SESSIONS =====================
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.study_sessions;

CREATE POLICY "Users can view their own sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own sessions" ON public.study_sessions
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete their own sessions" ON public.study_sessions
  FOR DELETE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== PROFILES =====================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== SUBSCRIPTIONS =====================
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== PROMO_REDEMPTIONS =====================
DROP POLICY IF EXISTS "Users can view own redemptions" ON public.promo_redemptions;
DROP POLICY IF EXISTS "Users can create own redemptions" ON public.promo_redemptions;

CREATE POLICY "Users can view own redemptions" ON public.promo_redemptions
  FOR SELECT USING (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

CREATE POLICY "Users can create own redemptions" ON public.promo_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_user_enabled(auth.uid()));

-- ===================== ADMIN_OVERRIDES =====================
DROP POLICY IF EXISTS "Users can read own override" ON public.admin_overrides;

CREATE POLICY "Users can read own override" ON public.admin_overrides
  FOR SELECT USING (user_id = auth.uid() AND public.is_user_enabled(auth.uid()));