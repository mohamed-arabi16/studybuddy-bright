-- Create grade_calculations table for Pro users to save grade profiles
CREATE TABLE public.grade_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL DEFAULT 'My Grade Calculation',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.grade_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own grade calculations" 
ON public.grade_calculations 
FOR SELECT 
USING ((auth.uid() = user_id) AND is_user_enabled(auth.uid()));

CREATE POLICY "Users can create their own grade calculations" 
ON public.grade_calculations 
FOR INSERT 
WITH CHECK ((auth.uid() = user_id) AND is_user_enabled(auth.uid()));

CREATE POLICY "Users can update their own grade calculations" 
ON public.grade_calculations 
FOR UPDATE 
USING ((auth.uid() = user_id) AND is_user_enabled(auth.uid()));

CREATE POLICY "Users can delete their own grade calculations" 
ON public.grade_calculations 
FOR DELETE 
USING ((auth.uid() = user_id) AND is_user_enabled(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_grade_calculations_user_id ON public.grade_calculations(user_id);
CREATE INDEX idx_grade_calculations_course_id ON public.grade_calculations(course_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_grade_calculations_updated_at
BEFORE UPDATE ON public.grade_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();