-- ============================================
-- Mastery, Quiz, and Past Exam Tables
-- ============================================

-- 1. topic_mastery: Tracks user's mastery level per topic
CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  mastery_score NUMERIC(5,2) DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  confidence TEXT DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  quiz_attempts_count INTEGER DEFAULT 0,
  total_time_spent_sec INTEGER DEFAULT 0,
  last_assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- 2. quiz_bank: Caches generated quizzes
CREATE TABLE IF NOT EXISTS public.quiz_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  version INTEGER DEFAULT 1,
  questions JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. quiz_attempts: Records each quiz attempt
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  quiz_bank_id UUID REFERENCES public.quiz_bank(id) ON DELETE SET NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  time_spent_sec INTEGER DEFAULT 0,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. past_exams: User-uploaded past exam files
CREATE TABLE IF NOT EXISTS public.past_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',
  extracted_text TEXT,
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. exam_questions: Individual questions from past exams
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES public.past_exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'unknown',
  points NUMERIC(5,2),
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. exam_topic_map: Mapping between exam questions and topics
CREATE TABLE IF NOT EXISTS public.exam_topic_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  weight NUMERIC(5,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_question_id, topic_id)
);

-- 7. topic_yield_metrics: Aggregated yield data per topic
CREATE TABLE IF NOT EXISTS public.topic_yield_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_exam_appearances INTEGER DEFAULT 0,
  total_points_possible NUMERIC(10,2) DEFAULT 0,
  normalized_yield_score NUMERIC(5,2) DEFAULT 0 CHECK (normalized_yield_score >= 0 AND normalized_yield_score <= 100),
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(topic_id, user_id)
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_topic_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_yield_metrics ENABLE ROW LEVEL SECURITY;

-- topic_mastery policies
CREATE POLICY "Users can view own mastery" ON public.topic_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mastery" ON public.topic_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON public.topic_mastery FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mastery" ON public.topic_mastery FOR DELETE USING (auth.uid() = user_id);

-- quiz_bank policies (read via topic ownership)
CREATE POLICY "Users can view quizzes for their topics" ON public.quiz_bank FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND t.user_id = auth.uid()));

-- quiz_attempts policies
CREATE POLICY "Users can view own attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- past_exams policies
CREATE POLICY "Users can view own exams" ON public.past_exams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exams" ON public.past_exams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exams" ON public.past_exams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exams" ON public.past_exams FOR DELETE USING (auth.uid() = user_id);

-- exam_questions policies (via past_exams ownership)
CREATE POLICY "Users can view own exam questions" ON public.exam_questions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.past_exams pe WHERE pe.id = past_exam_id AND pe.user_id = auth.uid()));

-- exam_topic_map policies (via exam_questions → past_exams ownership)
CREATE POLICY "Users can view own exam topic maps" ON public.exam_topic_map FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.exam_questions eq 
    JOIN public.past_exams pe ON pe.id = eq.past_exam_id 
    WHERE eq.id = exam_question_id AND pe.user_id = auth.uid()
  ));

-- topic_yield_metrics policies
CREATE POLICY "Users can view own yield metrics" ON public.topic_yield_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own yield metrics" ON public.topic_yield_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own yield metrics" ON public.topic_yield_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own yield metrics" ON public.topic_yield_metrics FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_topic ON public.topic_mastery(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_bank_topic ON public.quiz_bank(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic ON public.quiz_attempts(topic_id);
CREATE INDEX IF NOT EXISTS idx_past_exams_course ON public.past_exams(course_id);
CREATE INDEX IF NOT EXISTS idx_past_exams_user ON public.past_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON public.exam_questions(past_exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_topic_map_topic ON public.exam_topic_map(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_yield_metrics_course ON public.topic_yield_metrics(course_id);

-- ============================================
-- Database Functions
-- ============================================

-- Function to update mastery from quiz attempt (EWMA with time decay)
CREATE OR REPLACE FUNCTION public.update_mastery_from_quiz(
  p_user_id UUID,
  p_topic_id UUID,
  p_quiz_score NUMERIC,
  p_time_spent_sec INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_mastery NUMERIC := 0;
  v_new_mastery NUMERIC;
  v_attempts INTEGER := 0;
  v_alpha NUMERIC := 0.3; -- EWMA weight for new score
  v_confidence TEXT;
  v_result JSONB;
BEGIN
  -- Get current mastery
  SELECT mastery_score, quiz_attempts_count INTO v_current_mastery, v_attempts
  FROM topic_mastery
  WHERE user_id = p_user_id AND topic_id = p_topic_id;
  
  IF v_current_mastery IS NULL THEN
    v_current_mastery := 0;
    v_attempts := 0;
  END IF;
  
  -- Calculate new mastery using EWMA
  v_new_mastery := (v_alpha * p_quiz_score) + ((1 - v_alpha) * v_current_mastery);
  
  -- Determine confidence based on attempts
  v_confidence := CASE
    WHEN v_attempts + 1 >= 5 THEN 'high'
    WHEN v_attempts + 1 >= 2 THEN 'medium'
    ELSE 'low'
  END;
  
  -- Upsert mastery record
  INSERT INTO topic_mastery (user_id, topic_id, mastery_score, confidence, quiz_attempts_count, total_time_spent_sec, last_assessed_at)
  VALUES (p_user_id, p_topic_id, v_new_mastery, v_confidence, 1, p_time_spent_sec, now())
  ON CONFLICT (user_id, topic_id) DO UPDATE SET
    mastery_score = v_new_mastery,
    confidence = v_confidence,
    quiz_attempts_count = topic_mastery.quiz_attempts_count + 1,
    total_time_spent_sec = topic_mastery.total_time_spent_sec + p_time_spent_sec,
    last_assessed_at = now(),
    updated_at = now();
  
  v_result := jsonb_build_object(
    'previous_mastery', v_current_mastery,
    'new_mastery', v_new_mastery,
    'quiz_score', p_quiz_score,
    'attempts', v_attempts + 1,
    'confidence', v_confidence
  );
  
  RETURN v_result;
END;
$$;

-- Function to refresh yield metrics for a course
CREATE OR REPLACE FUNCTION public.refresh_topic_yield_metrics(p_course_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_points NUMERIC;
BEGIN
  -- Delete existing metrics for this course/user
  DELETE FROM topic_yield_metrics WHERE course_id = p_course_id AND user_id = p_user_id;
  
  -- Calculate and insert new metrics
  INSERT INTO topic_yield_metrics (topic_id, course_id, user_id, total_exam_appearances, total_points_possible, normalized_yield_score)
  SELECT 
    etm.topic_id,
    p_course_id,
    p_user_id,
    COUNT(DISTINCT eq.past_exam_id) as appearances,
    COALESCE(SUM(eq.points * etm.weight), 0) as points,
    0 -- Will update normalized score after
  FROM exam_topic_map etm
  JOIN exam_questions eq ON eq.id = etm.exam_question_id
  JOIN past_exams pe ON pe.id = eq.past_exam_id
  WHERE pe.course_id = p_course_id AND pe.user_id = p_user_id
  GROUP BY etm.topic_id;
  
  -- Get max points for normalization
  SELECT MAX(total_points_possible) INTO v_max_points
  FROM topic_yield_metrics
  WHERE course_id = p_course_id AND user_id = p_user_id;
  
  -- Normalize scores (0-100)
  IF v_max_points > 0 THEN
    UPDATE topic_yield_metrics
    SET normalized_yield_score = (total_points_possible / v_max_points) * 100,
        last_calculated_at = now()
    WHERE course_id = p_course_id AND user_id = p_user_id;
  END IF;
END;
$$;

-- ============================================
-- Credit Costs
-- ============================================

INSERT INTO public.credit_costs (action_type, cost_credits, description, is_active)
VALUES 
  ('generate_quiz', 8, 'Generate AI quiz for topic mastery assessment', true),
  ('analyze_past_exam', 40, 'Analyze past exam and map to topics', true)
ON CONFLICT (action_type) DO UPDATE SET
  cost_credits = EXCLUDED.cost_credits,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Updated_at Triggers
-- ============================================

CREATE TRIGGER update_topic_mastery_updated_at
  BEFORE UPDATE ON public.topic_mastery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_past_exams_updated_at
  BEFORE UPDATE ON public.past_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topic_yield_metrics_updated_at
  BEFORE UPDATE ON public.topic_yield_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();