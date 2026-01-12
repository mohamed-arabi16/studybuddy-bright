# Operations Runbooks

This document contains procedures for handling common operational issues in the StudyBuddy production environment.

## Table of Contents
1. [Stuck AI Jobs](#1-stuck-ai-jobs)
2. [Stripe Webhook Failures](#2-stripe-webhook-failures)
3. [Database Restore](#3-database-restore)
4. [Rate Limit Issues](#4-rate-limit-issues)
5. [Emergency Procedures](#5-emergency-procedures)

---

## 1. Stuck AI Jobs

### Symptoms
- Users report "extraction in progress" for extended periods (>5 minutes)
- `ai_jobs` table shows jobs with `status = 'running'` older than 5 minutes

### Diagnosis

```sql
-- Find stuck jobs
SELECT 
    id,
    user_id,
    course_id,
    job_type,
    status,
    created_at,
    NOW() - created_at AS age
FROM ai_jobs
WHERE status = 'running'
AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at ASC;
```

### Resolution

```sql
-- Mark stuck jobs as failed
UPDATE ai_jobs
SET 
    status = 'failed',
    error_message = 'Job timed out - marked by ops',
    updated_at = NOW()
WHERE status = 'running'
AND created_at < NOW() - INTERVAL '5 minutes';

-- Also update associated course_files if any
UPDATE course_files cf
SET extraction_status = 'failed'
FROM ai_jobs aj
WHERE cf.course_id = aj.course_id
AND cf.user_id = aj.user_id
AND aj.status = 'failed'
AND cf.extraction_status = 'extracting';
```

### Post-Resolution
1. Notify affected users via email (optional)
2. Check Edge Function logs in Supabase Dashboard for root cause
3. Monitor for recurrence

---

## 2. Stripe Webhook Failures

### Symptoms
- Users report payment succeeded but subscription not updated
- Stripe Dashboard shows webhook delivery failures
- `subscriptions` table has stale data

### Diagnosis

```sql
-- Check recent subscription updates
SELECT 
    user_id,
    status,
    stripe_subscription_id,
    stripe_event_id,
    last_webhook_at,
    updated_at
FROM subscriptions
ORDER BY updated_at DESC
LIMIT 20;

-- Check webhook_events for duplicates or gaps
SELECT 
    event_id,
    event_type,
    processed_at
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Resolution

#### Option A: Replay Webhook from Stripe Dashboard
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find the failed event
3. Click "Resend"

#### Option B: Manual Subscription Update
```sql
-- Find user's Stripe customer ID
SELECT stripe_customer_id, stripe_subscription_id, status
FROM subscriptions
WHERE user_id = '<USER_ID>';

-- Update subscription status manually
UPDATE subscriptions
SET 
    status = 'active',
    current_period_end = '<PERIOD_END_FROM_STRIPE>',
    last_webhook_at = NOW(),
    updated_at = NOW()
WHERE user_id = '<USER_ID>';
```

### Prevention
1. Ensure `STRIPE_WEBHOOK_SECRET` environment variable is correct
2. Check Supabase Edge Function logs for signature verification failures
3. Verify endpoint URL in Stripe Dashboard matches production URL

---

## 3. Database Restore

### Prerequisites
- Access to Supabase Dashboard (Project Settings)
- Appropriate permissions to perform restore

### Point-in-Time Recovery (PITR)

#### Via Supabase Dashboard
1. Go to Project Settings → Database → Backups
2. Select "Point in Time Recovery"
3. Choose the timestamp to restore to
4. Confirm restore (this creates a new database)

#### Post-Restore Checklist
1. Verify auth.users table is intact
2. Check profiles table for user data
3. Verify subscription statuses match Stripe
4. Run integrity checks:

```sql
-- Check for orphaned records
SELECT COUNT(*) as orphaned_profiles
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.id IS NULL;

SELECT COUNT(*) as orphaned_courses
FROM courses c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE u.id IS NULL;
```

### Full Backup Restore
1. Download backup from Supabase Dashboard
2. Create new Supabase project (if needed)
3. Use `pg_restore` to restore data
4. Update environment variables with new project credentials

---

## 4. Rate Limit Issues

### Symptoms
- Users receive 429 "Rate limit exceeded" errors
- Legitimate users blocked from AI extractions

### Diagnosis

```sql
-- Check user's recent AI jobs
SELECT 
    id,
    job_type,
    status,
    created_at
FROM ai_jobs
WHERE user_id = '<USER_ID>'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Count by user (find abusers)
SELECT 
    user_id,
    COUNT(*) as job_count
FROM ai_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
ORDER BY job_count DESC
LIMIT 20;
```

### Resolution

#### For Legitimate Users - Grant Temporary Override
```sql
-- Add or update admin override to increase limit
INSERT INTO admin_overrides (user_id, quota_overrides, notes, created_by)
VALUES (
    '<USER_ID>',
    '{"ai_extractions": 20}'::jsonb,
    'Temporary rate limit increase - expires in 24h',
    '<ADMIN_USER_ID>'
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    quota_overrides = admin_overrides.quota_overrides || '{"ai_extractions": 20}'::jsonb,
    notes = 'Temporary rate limit increase',
    updated_at = NOW();
```

#### For Abusive Users
1. Review usage patterns
2. Consider disabling account if abuse confirmed:
```sql
UPDATE profiles
SET is_disabled = true
WHERE user_id = '<ABUSIVE_USER_ID>';
```

---

## 5. Emergency Procedures

### 5.1 Disable All AI Extractions
If the AI provider is down or costs are spiking:

1. Temporarily disable the Edge Function in Supabase Dashboard
2. Or update rate limits to 0 temporarily

### 5.2 Emergency User Disable
```sql
-- Disable user account
UPDATE profiles
SET is_disabled = true
WHERE user_id = '<USER_ID>';

-- Optionally, invalidate their sessions
-- (Requires service role key)
```

### 5.3 Roll Back Recent Changes
If a recent deployment caused issues:

1. Revert code changes via GitHub
2. Re-deploy from previous tagged release
3. If database migration caused issues, contact Supabase support for PITR

### 5.4 Contact Information
- **Supabase Support**: support@supabase.io
- **Stripe Support**: Stripe Dashboard → Help
- **Sentry Issues**: Check Sentry Dashboard for error tracking

---

## Monitoring Queries

### Daily Health Check
```sql
-- Active users in last 24h
SELECT COUNT(DISTINCT user_id) as active_users
FROM ai_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Failed jobs in last 24h
SELECT COUNT(*) as failed_jobs
FROM ai_jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours';

-- Subscription status breakdown
SELECT status, COUNT(*) as count
FROM subscriptions
GROUP BY status;

-- AI job success rate
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ai_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Weekly Metrics
```sql
-- MRR estimate (active subscriptions)
SELECT 
    COUNT(*) as active_subs,
    COUNT(*) * 9.99 as estimated_mrr
FROM subscriptions
WHERE status = 'active';

-- User growth
SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as new_users
FROM profiles
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week;

-- AI extraction usage
SELECT 
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as extractions,
    COUNT(DISTINCT user_id) as unique_users
FROM ai_jobs
WHERE job_type = 'extract_topics'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

---

## Appendix: Environment Variables Reference

| Variable | Environment | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Admin access key (never expose client-side) |
| `STRIPE_SECRET_KEY` | Edge Functions only | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Edge Functions only | Stripe webhook signature verification |
| `LOVABLE_API_KEY` | Edge Functions only | AI API key |
| `VITE_SENTRY_DSN` | Frontend | Sentry error tracking DSN |
| `GOOGLE_CLIENT_ID` | Edge Functions only | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Edge Functions only | OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | Edge Functions only | AES key for token encryption |
