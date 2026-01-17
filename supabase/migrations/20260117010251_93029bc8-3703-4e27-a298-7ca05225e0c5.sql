-- Add billing_anchor_date column to user_credits for rolling reset cycles
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS billing_anchor_date DATE;

-- Set default anchor to account creation date or current date for existing users
UPDATE user_credits uc
SET billing_anchor_date = COALESCE(
  (SELECT DATE(p.created_at) FROM profiles p WHERE p.user_id = uc.user_id),
  CURRENT_DATE
)
WHERE billing_anchor_date IS NULL;

-- Set default for new records
ALTER TABLE user_credits 
ALTER COLUMN billing_anchor_date SET DEFAULT CURRENT_DATE;