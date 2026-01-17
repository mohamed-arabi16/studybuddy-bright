-- =====================================================
-- Cost Calculation System: Model Pricing + Trigger
-- =====================================================

-- Model pricing table (per 1M tokens)
CREATE TABLE IF NOT EXISTS public.model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text UNIQUE NOT NULL,
  input_cost_per_million numeric NOT NULL DEFAULT 0.15,
  output_cost_per_million numeric NOT NULL DEFAULT 0.60,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (costs are not secret)
CREATE POLICY "Anyone can read model pricing"
  ON public.model_pricing FOR SELECT
  TO authenticated
  USING (true);

-- Seed pricing data for supported models
INSERT INTO public.model_pricing (model_name, input_cost_per_million, output_cost_per_million) VALUES
  ('google/gemini-2.5-flash', 0.15, 0.60),
  ('google/gemini-2.5-flash-lite', 0.075, 0.30),
  ('google/gemini-2.5-pro', 1.25, 5.00),
  ('google/gemini-3-pro-preview', 1.50, 6.00),
  ('google/gemini-3-flash-preview', 0.20, 0.80),
  ('openai/gpt-5', 2.50, 10.00),
  ('openai/gpt-5-mini', 0.40, 1.60),
  ('openai/gpt-5-nano', 0.10, 0.40),
  ('openai/gpt-5.2', 3.00, 12.00)
ON CONFLICT (model_name) DO UPDATE SET
  input_cost_per_million = EXCLUDED.input_cost_per_million,
  output_cost_per_million = EXCLUDED.output_cost_per_million,
  updated_at = now();

-- Trigger function to auto-compute cost when tokens are recorded
CREATE OR REPLACE FUNCTION public.compute_credit_event_cost()
RETURNS TRIGGER AS $$
DECLARE
  input_rate numeric;
  output_rate numeric;
BEGIN
  -- Only compute if we have token data
  IF NEW.tokens_in IS NULL AND NEW.tokens_out IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get pricing for this model (default to gemini-2.5-flash rates)
  SELECT 
    COALESCE(mp.input_cost_per_million, 0.15),
    COALESCE(mp.output_cost_per_million, 0.60)
  INTO input_rate, output_rate
  FROM public.model_pricing mp
  WHERE mp.model_name = NEW.model
  LIMIT 1;
  
  -- Use default if model not found
  IF input_rate IS NULL THEN
    input_rate := 0.15;
    output_rate := 0.60;
  END IF;
  
  -- Calculate cost: (tokens / 1,000,000) * rate_per_million
  NEW.computed_cost_usd := 
    (COALESCE(NEW.tokens_in, 0)::numeric / 1000000.0 * input_rate) +
    (COALESCE(NEW.tokens_out, 0)::numeric / 1000000.0 * output_rate);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on credit_usage_events
DROP TRIGGER IF EXISTS compute_cost_trigger ON public.credit_usage_events;
CREATE TRIGGER compute_cost_trigger
  BEFORE INSERT OR UPDATE ON public.credit_usage_events
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_credit_event_cost();

-- Backfill existing records with computed costs
UPDATE public.credit_usage_events cue
SET computed_cost_usd = (
  SELECT 
    (COALESCE(cue.tokens_in, 0)::numeric / 1000000.0 * COALESCE(mp.input_cost_per_million, 0.15)) +
    (COALESCE(cue.tokens_out, 0)::numeric / 1000000.0 * COALESCE(mp.output_cost_per_million, 0.60))
  FROM public.model_pricing mp
  WHERE mp.model_name = cue.model
  LIMIT 1
)
WHERE cue.tokens_in IS NOT NULL OR cue.tokens_out IS NOT NULL;

-- Fallback for records with tokens but no matching model
UPDATE public.credit_usage_events
SET computed_cost_usd = (
  COALESCE(tokens_in, 0)::numeric / 1000000.0 * 0.15 +
  COALESCE(tokens_out, 0)::numeric / 1000000.0 * 0.60
)
WHERE (tokens_in IS NOT NULL OR tokens_out IS NOT NULL) AND computed_cost_usd IS NULL;