CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: admin_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quota_overrides jsonb DEFAULT '{}'::jsonb,
    trial_extension_days integer DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    job_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    input_hash text,
    result_json jsonb,
    error_message text,
    questions_for_student text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['extract_topics'::text, 'generate_plan'::text]))),
    CONSTRAINT ai_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'needs_review'::text])))
);


--
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    date date NOT NULL,
    topics_json text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: course_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    mime_type text DEFAULT 'application/pdf'::text NOT NULL,
    extracted_text text,
    extraction_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_files_extraction_status_check CHECK ((extraction_status = ANY (ARRAY['pending'::text, 'extracting'::text, 'extracted'::text, 'completed'::text, 'failed'::text, 'empty'::text, 'manual_required'::text])))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    exam_date date,
    status text DEFAULT 'active'::text,
    color text DEFAULT '#6366f1'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'completed'::text])))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    feedback_type text DEFAULT 'general'::text NOT NULL,
    message text NOT NULL,
    rating integer,
    status text DEFAULT 'new'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: google_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expires_at timestamp with time zone NOT NULL,
    calendar_id text DEFAULT 'primary'::text,
    is_active boolean DEFAULT true,
    auto_sync boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_monthly numeric(10,2) DEFAULT 0,
    price_yearly numeric(10,2) DEFAULT 0,
    limits jsonb DEFAULT '{"courses": 3, "ai_extractions": 5, "topics_per_course": 20}'::jsonb,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pomodoro_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pomodoro_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    topic_id uuid,
    duration_minutes integer DEFAULT 25 NOT NULL,
    session_type text DEFAULT 'focus'::text,
    completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pomodoro_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['focus'::text, 'short_break'::text, 'long_break'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    display_name text,
    avatar_url text,
    language text DEFAULT 'ar'::text,
    is_disabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    daily_study_hours numeric(4,1) DEFAULT 3.0,
    study_days_per_week integer DEFAULT 6,
    days_off text[] DEFAULT '{}'::text[],
    phone_number text,
    department text,
    university text
);


--
-- Name: study_plan_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_version integer DEFAULT 1 NOT NULL,
    date date NOT NULL,
    total_hours numeric(4,1) DEFAULT 3.0 NOT NULL,
    is_day_off boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: study_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_day_id uuid NOT NULL,
    course_id uuid NOT NULL,
    topic_id uuid,
    hours numeric(4,1) NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: study_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_code text NOT NULL,
    completed_tasks text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'trialing'::text NOT NULL,
    trial_start timestamp with time zone DEFAULT now(),
    trial_end timestamp with time zone DEFAULT (now() + '14 days'::interval),
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_event_id text,
    last_webhook_at timestamp with time zone,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'trialing'::text, 'canceled'::text, 'expired'::text, 'past_due'::text])))
);


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    difficulty_weight integer DEFAULT 3,
    exam_importance integer DEFAULT 3,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    notes text,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    confidence_level text DEFAULT 'medium'::text,
    source_page integer,
    source_context text,
    prerequisite_ids uuid[] DEFAULT '{}'::uuid[],
    estimated_hours numeric DEFAULT 0.5,
    CONSTRAINT topics_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT topics_difficulty_weight_check CHECK (((difficulty_weight >= 1) AND (difficulty_weight <= 5))),
    CONSTRAINT topics_exam_importance_check CHECK (((exam_importance >= 1) AND (exam_importance <= 5))),
    CONSTRAINT topics_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'done'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_overrides admin_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_overrides
    ADD CONSTRAINT admin_overrides_pkey PRIMARY KEY (id);


--
-- Name: admin_overrides admin_overrides_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_overrides
    ADD CONSTRAINT admin_overrides_user_id_key UNIQUE (user_id);


--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: course_files course_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_files
    ADD CONSTRAINT course_files_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_user_id_key UNIQUE (user_id);


--
-- Name: plans plans_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_name_key UNIQUE (name);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: pomodoro_sessions pomodoro_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: study_plan_days study_plan_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_days
    ADD CONSTRAINT study_plan_days_pkey PRIMARY KEY (id);


--
-- Name: study_plan_days study_plan_days_user_id_date_plan_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_days
    ADD CONSTRAINT study_plan_days_user_id_date_plan_version_key UNIQUE (user_id, date, plan_version);


--
-- Name: study_plan_items study_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_pkey PRIMARY KEY (id);


--
-- Name: study_sessions study_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_pkey PRIMARY KEY (id);


--
-- Name: study_sessions study_sessions_session_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_session_code_key UNIQUE (session_code);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_ai_jobs_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_course_id ON public.ai_jobs USING btree (course_id);


--
-- Name: idx_ai_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_status ON public.ai_jobs USING btree (status);


--
-- Name: idx_ai_jobs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_user_id ON public.ai_jobs USING btree (user_id);


--
-- Name: idx_allocations_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_course_id ON public.allocations USING btree (course_id);


--
-- Name: idx_allocations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_date ON public.allocations USING btree (date);


--
-- Name: idx_course_files_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_files_course_id ON public.course_files USING btree (course_id);


--
-- Name: idx_course_files_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_files_user_id ON public.course_files USING btree (user_id);


--
-- Name: idx_courses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_user_id ON public.courses USING btree (user_id);


--
-- Name: idx_pomodoro_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pomodoro_sessions_user_id ON public.pomodoro_sessions USING btree (user_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_study_plan_days_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_days_user_date ON public.study_plan_days USING btree (user_id, date);


--
-- Name: idx_study_plan_items_plan_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_plan_items_plan_day ON public.study_plan_items USING btree (plan_day_id);


--
-- Name: idx_study_sessions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_study_sessions_code ON public.study_sessions USING btree (session_code);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_topics_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_course_id ON public.topics USING btree (course_id);


--
-- Name: idx_topics_prerequisite_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_prerequisite_ids ON public.topics USING gin (prerequisite_ids);


--
-- Name: idx_topics_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_status ON public.topics USING btree (status);


--
-- Name: idx_topics_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_user_id ON public.topics USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: admin_overrides update_admin_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_admin_overrides_updated_at BEFORE UPDATE ON public.admin_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_jobs update_ai_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_jobs_updated_at BEFORE UPDATE ON public.ai_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: course_files update_course_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_course_files_updated_at BEFORE UPDATE ON public.course_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: courses update_courses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feedback update_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: google_calendar_connections update_google_calendar_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_google_calendar_connections_updated_at BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: study_sessions update_study_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON public.study_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: topics update_topics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_overrides admin_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_overrides
    ADD CONSTRAINT admin_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: admin_overrides admin_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_overrides
    ADD CONSTRAINT admin_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_jobs ai_jobs_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_files course_files_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_files
    ADD CONSTRAINT course_files_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: courses courses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pomodoro_sessions pomodoro_sessions_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: pomodoro_sessions pomodoro_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: study_plan_items study_plan_items_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: study_plan_items study_plan_items_plan_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_plan_day_id_fkey FOREIGN KEY (plan_day_id) REFERENCES public.study_plan_days(id) ON DELETE CASCADE;


--
-- Name: study_plan_items study_plan_items_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_plan_items
    ADD CONSTRAINT study_plan_items_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: study_sessions study_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: topics topics_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: topics topics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feedback Admins can delete feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete feedback" ON public.feedback FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_overrides Admins can manage overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage overrides" ON public.admin_overrides USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage plans" ON public.plans USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feedback Admins can update feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feedback Admins can view all feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Anyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING ((is_active = true));


--
-- Name: allocations Users can create allocations for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create allocations for their courses" ON public.allocations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = allocations.course_id) AND (courses.user_id = auth.uid())))));


--
-- Name: feedback Users can create feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create feedback" ON public.feedback FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_jobs Users can create own ai jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own ai jobs" ON public.ai_jobs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: course_files Users can create own course files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own course files" ON public.course_files FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: study_plan_days Users can create own plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own plan days" ON public.study_plan_days FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: study_plan_items Users can create own plan items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own plan items" ON public.study_plan_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: google_calendar_connections Users can create their own calendar connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own calendar connections" ON public.google_calendar_connections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: courses Users can create their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own courses" ON public.courses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pomodoro_sessions Users can create their own pomodoro sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own pomodoro sessions" ON public.pomodoro_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: study_sessions Users can create their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own sessions" ON public.study_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: topics Users can create their own topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own topics" ON public.topics FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: allocations Users can delete allocations for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete allocations for their courses" ON public.allocations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = allocations.course_id) AND (courses.user_id = auth.uid())))));


--
-- Name: course_files Users can delete own course files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own course files" ON public.course_files FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: study_plan_days Users can delete own plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plan days" ON public.study_plan_days FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: study_plan_items Users can delete own plan items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plan items" ON public.study_plan_items FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: google_calendar_connections Users can delete their own calendar connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own calendar connections" ON public.google_calendar_connections FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: courses Users can delete their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own courses" ON public.courses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can delete their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own sessions" ON public.study_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: topics Users can delete their own topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own topics" ON public.topics FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: allocations Users can update allocations for their courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update allocations for their courses" ON public.allocations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = allocations.course_id) AND (courses.user_id = auth.uid())))));


--
-- Name: ai_jobs Users can update own ai jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own ai jobs" ON public.ai_jobs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: course_files Users can update own course files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own course files" ON public.course_files FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: study_plan_days Users can update own plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plan days" ON public.study_plan_days FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: study_plan_items Users can update own plan items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plan items" ON public.study_plan_items FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: google_calendar_connections Users can update their own calendar connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own calendar connections" ON public.google_calendar_connections FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: courses Users can update their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own courses" ON public.courses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own sessions" ON public.study_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can update their own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own subscription" ON public.subscriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: topics Users can update their own topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own topics" ON public.topics FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_jobs Users can view own ai jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own ai jobs" ON public.ai_jobs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: course_files Users can view own course files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own course files" ON public.course_files FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: feedback Users can view own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own feedback" ON public.feedback FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: study_plan_days Users can view own plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own plan days" ON public.study_plan_days FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: study_plan_items Users can view own plan items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own plan items" ON public.study_plan_items FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: allocations Users can view their course allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their course allocations" ON public.allocations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.courses
  WHERE ((courses.id = allocations.course_id) AND (courses.user_id = auth.uid())))));


--
-- Name: google_calendar_connections Users can view their own calendar connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own calendar connections" ON public.google_calendar_connections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: courses Users can view their own courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own courses" ON public.courses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pomodoro_sessions Users can view their own pomodoro sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pomodoro sessions" ON public.pomodoro_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: study_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.study_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can view their own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscription" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: topics Users can view their own topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own topics" ON public.topics FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: course_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: pomodoro_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_days ENABLE ROW LEVEL SECURITY;

--
-- Name: study_plan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

--
-- Name: study_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;