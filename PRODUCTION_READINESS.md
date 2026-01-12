# Production Readiness Spec - Phase 3

This document outlines the requirements and standards for moving "Zen Study Spot v2" from a prototype to a production-hardened SaaS application.

## 1. Environments and Release Discipline

### Current State
- Single environment (Dev/Local).
- Direct schema edits via migrations file.
- Manual testing.

### Target State
- **Environments**:
  - **Dev**: Local development, connects to local Supabase or dedicated Dev project.
  - **Staging**: Mirror of Prod, used for final QA and integration tests. Connects to Stripe Test Mode.
  - **Prod**: Live environment. Connects to Stripe Live Mode.
- **Deployment**:
  - CI/CD pipeline (GitHub Actions).
  - Main branch automatically deploys to Staging.
  - Tagged releases (`v1.0.0`) trigger deploy to Prod.
- **Database Migrations**:
  - All schema changes must be versioned migrations (`supabase migration new ...`).
  - No manual edits in Supabase Dashboard for Staging/Prod.

## 2. Security Baseline and Data Protection

### Current State
- RLS enabled on all tables.
- Basic policies checking `auth.uid()` or ownership via `course_id`.
- Service role usage not fully audited.

### Target State
- **RLS Audit**:
  - Verify every table has `ENABLE ROW LEVEL SECURITY`.
  - Ensure `SELECT` policies are scoped to user ownership.
  - Ensure `INSERT/UPDATE/DELETE` policies strictly enforce ownership.
  - *Action Item*: Audit `admin_overrides` and `plans` tables (ensure standard users cannot read others' overrides or modify plans).
- **Storage Security**:
  - Buckets must be Private.
  - Files served via Signed URLs (short expiration).
  - Upload policies: Limit file types (PDF, txt, img), max size (e.g., 10MB).
- **Input Sanitization**:
  - Sanitize all user-provided text (Syllabus, notes) before rendering or sending to AI.
  - Strict validation on AI prompts to prevent injection.
- **Secrets**:
  - `SUPABASE_SERVICE_ROLE_KEY` must strictly be server-side (Edge Functions only).
  - Stripe Secret Keys must be environment variables, never committed.

## 3. Reliability, Background Jobs, and Idempotency

### Current State
- AI is synchronous (Client awaits `mockAI` response).
- No retry logic or persistence for failed AI runs.

### Target State
- **Async AI Pipeline**:
  - User request -> Insert row in `ai_jobs` table (status: `queued`).
  - Database Trigger or Edge Function picks up job.
  - Updates status: `processing` -> `completed` (with result) or `failed`.
  - Client polls or subscribes to `ai_jobs` changes.
- **Idempotency**:
  - UI checks for existing "pending" jobs for the same course/input before submitting.
  - Backend deduplication based on input hash.
- **Failure Handling**:
  - Retries: Max 3 retries with exponential backoff for AI provider 5xx errors.
  - Dead Letter: Failed jobs persist with error details for admin review.

## 4. Observability and Incident Readiness

### Current State
- `console.log` for debugging.
- No centralized error tracking.

### Target State
- **Error Tracking**:
  - Integrate **Sentry** (React + Edge Functions).
  - Capture context: `user_id`, `course_id`, `environment`.
- **Logging**:
  - Structured logs in Supabase/Edge Functions.
  - Log critical events: `AI_RUN_START`, `AI_RUN_COMPLETE`, `PAYMENT_FAILED`.
- **Metrics**:
  - Dashboard tracking:
    - Active AI Jobs.
    - Average AI Duration.
    - Stripe MRR/Churn.
- **Runbooks**:
  - Document procedures for "Stuck Jobs", "Stripe Webhook Failures", "Database Restore".

## 5. Performance and Cost Controls

### Current State
- Mock AI (free).
- Basic queries.
- No visible rate limiting.

### Target State
- **AI Cost Guards**:
  - Hard limit on input tokens (truncate or summarize large inputs).
  - Cache results: If input hash matches previous successful run, return cached result.
  - Daily/Monthly quotas per plan (enforced at API/DB level, not just UI).
- **Database Optimization**:
  - Index `user_id` on all tables.
  - Index `course_id` on child tables (`topics`, `inputs`, `allocations`).
  - Pagination for `topics` and `logs` lists.
- **Frontend**:
  - Lazy load heavy views (Calendar).
  - Optimistic UI updates for better perceived performance.

## 6. Stripe Production Readiness

### Current State
- UI Subscription check (`useSubscription`).
- Likely assumes Stripe Test mode or mocked data.

### Target State
- **Webhooks**:
  - Implement Edge Function to handle Stripe Webhooks (`invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`).
  - Verify Stripe Signature.
  - Idempotent processing (handle duplicate webhook events safely).
- **State Sync**:
  - Database `subscriptions` table must be the source of truth, updated strictly by webhooks.
  - UI reads from DB, never assumes status based on client-side actions alone.
- **Portal**:
  - "Manage Subscription" button linking to Stripe Customer Portal.

## 7. UX and Compliance

### Current State
- Functional prototype UI.

### Target State
- **Legal**:
  - Terms of Service & Privacy Policy pages (accessible publically).
  - Cookie Consent banner (if analytics used).
- **Data Hygiene**:
  - "Delete Account" button (cascading delete of all user data).
  - "Export Data" (Download Course/Plan as PDF/JSON).
- **Onboarding**:
  - Empty states guide user ("Create your first course").
  - Tooltips for complex features.

## Go-Live Checklist

- [x] **Environment**: Staging environment created and verified.
  - CI/CD pipeline configured in `.github/workflows/deploy.yml`
  - Environment configs: `.env.staging`, `.env.production`
- [x] **Security**: RLS policies audited and tests passed.
  - Migration: `20260112234356_production_readiness_security.sql`
  - All tables have RLS enabled
  - `admin_overrides`: Users can only view their own override
  - `plans`: Only active plans visible to public
- [x] **Storage**: Buckets private, file size limits enforced.
  - Configuration documented in migration comments
  - Storage policies enforce user ownership
- [x] **Async AI**: `ai_jobs` table and processing logic implemented.
  - Table: `ai_jobs` with status tracking
  - Edge Function: `extract-topics` with job management
  - Rate limiting: `_shared/rate-limit.ts`
  - Response caching: `ai_response_cache` table
- [x] **Stripe**: Webhooks handling implemented and verified (Test Mode).
  - Edge Function: `stripe-webhook`
  - Idempotent processing via `webhook_events` table
  - Handles: subscription.created/updated/deleted, payment success/failed, checkout.completed
- [x] **Logging**: Sentry connected.
  - Frontend: `src/main.tsx` with Sentry initialization
  - Backend: Structured logging in `_shared/logger.ts`
- [x] **Legal**: Terms/Privacy pages live.
  - Terms: `/terms` route
  - Privacy: `/privacy` route
- [x] **Cleanup**: Remove `mockAI` (or hide behind dev flag).
  - Production AI endpoint configured via `LOVABLE_API_KEY`
- [x] **Runbooks**: Operations documentation created.
  - Location: `docs/RUNBOOKS.md`
