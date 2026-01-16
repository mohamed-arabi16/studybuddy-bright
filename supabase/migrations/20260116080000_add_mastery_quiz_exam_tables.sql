-- =============================================
-- PHASE A: ADAPTIVE MASTERY + PAST EXAM INSIGHT DATA MODEL
-- Creates tables for mastery tracking, quiz system, and past exam analysis
-- =============================================

-- ========================
-- A1) MASTERY & QUIZ TABLES
-- ========================

-- topic_mastery: Tracks user's mastery level per topic
CREATE TABLE IF NOT EXISTS public.topic_mastery (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    mastery_score integer DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
    confidence integer DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    last_assessed_at timestamptz,
    quiz_attempts_count integer DEFAULT 0,
    total_time_spent_sec integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, topic_id)
);

-- quiz_bank: Cached quiz content per topic (avoid repeated AI generation)
CREATE TABLE IF NOT EXISTS public.quiz_bank (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    version integer DEFAULT 1,
    questions jsonb NOT NULL,
    question_count integer DEFAULT 0,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (topic_id, difficulty, version)
);

-- quiz_attempts: Records each quiz attempt for analytics and mastery calculation
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    quiz_bank_id uuid REFERENCES public.quiz_bank(id) ON DELETE SET NULL,
    score integer NOT NULL CHECK (score >= 0 AND score <= 100),
    time_spent_sec integer DEFAULT 0,
    answers jsonb,
    questions_answered integer DEFAULT 0,
    correct_answers integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ========================
-- A2) PAST EXAM TABLES
-- ========================

-- past_exams: User-uploaded past exam files
CREATE TABLE IF NOT EXISTS public.past_exams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    exam_date date,
    file_id uuid REFERENCES public.course_files(id) ON DELETE SET NULL,
    extracted_text text,
    analysis_status text DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
    analysis_result jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- exam_questions: Individual questions extracted from past exams (for auditability)
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    past_exam_id uuid NOT NULL REFERENCES public.past_exams(id) ON DELETE CASCADE,
    question_text text NOT NULL,
    question_number text,
    question_type text DEFAULT 'unknown',
    marks integer,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- exam_topic_map: Mapping between exam questions and topics with weights
CREATE TABLE IF NOT EXISTS public.exam_topic_map (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    past_exam_id uuid NOT NULL REFERENCES public.past_exams(id) ON DELETE CASCADE,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    weight numeric(3,2) DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    evidence jsonb,
    question_ids uuid[],
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (past_exam_id, topic_id)
);

-- topic_yield_metrics: Aggregated yield metrics per topic from past exams
CREATE TABLE IF NOT EXISTS public.topic_yield_metrics (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    frequency_count integer DEFAULT 0,
    normalized_yield numeric(4,3) DEFAULT 0 CHECK (normalized_yield >= 0 AND normalized_yield <= 1),
    total_weight numeric(5,2) DEFAULT 0,
    exam_count integer DEFAULT 0,
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, course_id, topic_id)
);

-- ========================
-- A3) PLAN EXPLAINABILITY EXTENSIONS
-- ========================

-- Add yield and mastery related fields to study_plan_items
ALTER TABLE public.study_plan_items
    ADD COLUMN IF NOT EXISTS yield_weight numeric(4,3),
    ADD COLUMN IF NOT EXISTS mastery_snapshot integer,
    ADD COLUMN IF NOT EXISTS scheduling_factors jsonb;

COMMENT ON COLUMN public.study_plan_items.yield_weight IS 'Yield weight from past exam analysis (0-1 scale)';
COMMENT ON COLUMN public.study_plan_items.mastery_snapshot IS 'Mastery score at the time of scheduling (0-100)';
COMMENT ON COLUMN public.study_plan_items.scheduling_factors IS 'JSON object with detailed scheduling factors (exam_proximity, missed_carryover, load_balance, etc.)';

-- ========================
-- INDEXES FOR PERFORMANCE
-- ========================

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_id ON public.topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic_id ON public.topic_mastery(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_bank_topic_difficulty ON public.quiz_bank(topic_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_quiz_bank_course_id ON public.quiz_bank(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id ON public.quiz_attempts(topic_id);
CREATE INDEX IF NOT EXISTS idx_past_exams_user_course ON public.past_exams(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON public.exam_questions(past_exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_topic_map_exam_id ON public.exam_topic_map(past_exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_topic_map_topic_id ON public.exam_topic_map(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_yield_metrics_course ON public.topic_yield_metrics(user_id, course_id);

-- ========================
-- TRIGGERS FOR UPDATED_AT
-- ========================

CREATE TRIGGER update_topic_mastery_updated_at 
    BEFORE UPDATE ON public.topic_mastery 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_past_exams_updated_at 
    BEFORE UPDATE ON public.past_exams 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- A4) ROW LEVEL SECURITY
-- ========================

-- Enable RLS on all new tables
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_topic_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_yield_metrics ENABLE ROW LEVEL SECURITY;

-- topic_mastery policies: Users can CRUD only their own mastery data
CREATE POLICY "Users can view own topic mastery"
    ON public.topic_mastery FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic mastery"
    ON public.topic_mastery FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic mastery"
    ON public.topic_mastery FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic mastery"
    ON public.topic_mastery FOR DELETE
    USING (auth.uid() = user_id);

-- quiz_bank policies: Readable by owner or course owner; writes via edge function
CREATE POLICY "Users can view own quizzes"
    ON public.quiz_bank FOR SELECT
    USING (auth.uid() = created_by OR EXISTS (
        SELECT 1 FROM public.courses 
        WHERE courses.id = quiz_bank.course_id 
        AND courses.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own quizzes"
    ON public.quiz_bank FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own quizzes"
    ON public.quiz_bank FOR DELETE
    USING (auth.uid() = created_by);

-- quiz_attempts policies: Users can CRUD only their own attempts
CREATE POLICY "Users can view own quiz attempts"
    ON public.quiz_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts"
    ON public.quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quiz attempts"
    ON public.quiz_attempts FOR DELETE
    USING (auth.uid() = user_id);

-- past_exams policies: Users can CRUD only their own exams
CREATE POLICY "Users can view own past exams"
    ON public.past_exams FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own past exams"
    ON public.past_exams FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own past exams"
    ON public.past_exams FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own past exams"
    ON public.past_exams FOR DELETE
    USING (auth.uid() = user_id);

-- exam_questions policies: Access through past_exams ownership
CREATE POLICY "Users can view exam questions for own exams"
    ON public.exam_questions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_questions.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert exam questions for own exams"
    ON public.exam_questions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_questions.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete exam questions for own exams"
    ON public.exam_questions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_questions.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

-- exam_topic_map policies: Access through past_exams ownership
CREATE POLICY "Users can view exam topic maps for own exams"
    ON public.exam_topic_map FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_topic_map.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert exam topic maps for own exams"
    ON public.exam_topic_map FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_topic_map.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can update exam topic maps for own exams"
    ON public.exam_topic_map FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_topic_map.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete exam topic maps for own exams"
    ON public.exam_topic_map FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.past_exams 
        WHERE past_exams.id = exam_topic_map.past_exam_id 
        AND past_exams.user_id = auth.uid()
    ));

-- topic_yield_metrics policies: Users can CRUD only their own metrics
CREATE POLICY "Users can view own topic yield metrics"
    ON public.topic_yield_metrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic yield metrics"
    ON public.topic_yield_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic yield metrics"
    ON public.topic_yield_metrics FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic yield metrics"
    ON public.topic_yield_metrics FOR DELETE
    USING (auth.uid() = user_id);

-- ========================
-- B1) CREDIT COSTS FOR NEW OPERATIONS
-- ========================

-- Add new credit costs for quiz generation and exam analysis
INSERT INTO public.credit_costs (action_type, cost_credits, description, is_active)
VALUES 
    ('generate_quiz', 8, 'Generate AI quiz questions for a topic', true),
    ('analyze_past_exam', 40, 'Analyze past exam and map to topics', true)
ON CONFLICT (action_type) DO UPDATE SET
    cost_credits = EXCLUDED.cost_credits,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ========================
-- HELPER FUNCTION: Update mastery score after quiz attempt
-- Uses weighted exponential moving average
-- ========================

CREATE OR REPLACE FUNCTION public.update_mastery_from_quiz(
    p_user_id uuid,
    p_topic_id uuid,
    p_quiz_score integer,
    p_time_spent_sec integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_old_score integer;
    v_old_attempts integer;
    v_new_score integer;
    v_decay_factor numeric;
    v_days_since_last numeric;
    v_last_assessed timestamptz;
BEGIN
    -- Get existing mastery data
    SELECT mastery_score, quiz_attempts_count, last_assessed_at
    INTO v_old_score, v_old_attempts, v_last_assessed
    FROM topic_mastery
    WHERE user_id = p_user_id AND topic_id = p_topic_id;

    -- Calculate decay factor if there's existing data and time has passed
    IF v_last_assessed IS NOT NULL THEN
        v_days_since_last := EXTRACT(EPOCH FROM (now() - v_last_assessed)) / 86400.0;
        -- Decay factor: 0.98^days (2% decay per day, capped at 30 days)
        v_decay_factor := POWER(0.98, LEAST(v_days_since_last, 30));
    ELSE
        v_decay_factor := 1;
        v_old_score := 0;
        v_old_attempts := 0;
    END IF;

    -- Calculate new mastery score using EWMA
    -- Formula: new_score = 0.7 * (old_score * decay) + 0.3 * quiz_score
    v_new_score := ROUND(0.7 * (COALESCE(v_old_score, 0) * v_decay_factor) + 0.3 * p_quiz_score);
    v_new_score := GREATEST(0, LEAST(100, v_new_score)); -- Clamp to 0-100

    -- Upsert mastery record
    INSERT INTO topic_mastery (user_id, topic_id, mastery_score, last_assessed_at, quiz_attempts_count, total_time_spent_sec)
    VALUES (p_user_id, p_topic_id, v_new_score, now(), 1, p_time_spent_sec)
    ON CONFLICT (user_id, topic_id) DO UPDATE SET
        mastery_score = v_new_score,
        last_assessed_at = now(),
        quiz_attempts_count = topic_mastery.quiz_attempts_count + 1,
        total_time_spent_sec = topic_mastery.total_time_spent_sec + p_time_spent_sec,
        updated_at = now();

    RETURN jsonb_build_object(
        'old_score', COALESCE(v_old_score, 0),
        'new_score', v_new_score,
        'quiz_score', p_quiz_score,
        'decay_applied', v_decay_factor < 1,
        'attempts_count', COALESCE(v_old_attempts, 0) + 1
    );
END;
$$;

-- ========================
-- HELPER FUNCTION: Refresh topic yield metrics for a course
-- ========================

CREATE OR REPLACE FUNCTION public.refresh_topic_yield_metrics(
    p_user_id uuid,
    p_course_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_max_freq integer;
    v_updated_count integer;
BEGIN
    -- First, aggregate topic frequencies from exam_topic_map
    -- Delete existing metrics for this course/user
    DELETE FROM topic_yield_metrics
    WHERE user_id = p_user_id AND course_id = p_course_id;

    -- Get max frequency for normalization
    SELECT COALESCE(MAX(freq), 1) INTO v_max_freq
    FROM (
        SELECT COUNT(*) as freq
        FROM exam_topic_map etm
        JOIN past_exams pe ON pe.id = etm.past_exam_id
        WHERE pe.user_id = p_user_id AND pe.course_id = p_course_id
        GROUP BY etm.topic_id
    ) sub;

    -- Insert aggregated metrics
    INSERT INTO topic_yield_metrics (user_id, course_id, topic_id, frequency_count, normalized_yield, total_weight, exam_count)
    SELECT 
        p_user_id,
        p_course_id,
        etm.topic_id,
        COUNT(*)::integer as frequency_count,
        (COUNT(*)::numeric / v_max_freq)::numeric(4,3) as normalized_yield,
        COALESCE(SUM(etm.weight), 0)::numeric(5,2) as total_weight,
        COUNT(DISTINCT etm.past_exam_id)::integer as exam_count
    FROM exam_topic_map etm
    JOIN past_exams pe ON pe.id = etm.past_exam_id
    WHERE pe.user_id = p_user_id AND pe.course_id = p_course_id
    GROUP BY etm.topic_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN v_updated_count;
END;
$$;
