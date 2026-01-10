-- Add unique constraint on subscriptions.user_id for upsert to work properly
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);