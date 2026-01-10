-- Insert Free and Pro plans with updated limits
INSERT INTO public.plans (name, price_monthly, price_yearly, is_active, limits, features)
VALUES 
  ('Free', 0, 0, true, 
   '{"courses": 3, "topics_total": 50, "ai_extractions": 3}'::jsonb,
   '{"basic_scheduling": true, "smart_ai": false}'::jsonb),
  ('Pro', 9.99, 99.99, true,
   '{"courses": -1, "topics_total": -1, "ai_extractions": 50}'::jsonb,
   '{"basic_scheduling": true, "smart_ai": true, "priority_support": true}'::jsonb)
ON CONFLICT DO NOTHING;