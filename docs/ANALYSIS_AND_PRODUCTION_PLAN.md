# StudyBuddy Deep Analysis & Production Readiness Plan

## Executive Summary

**StudyBuddy** is a SaaS study planning application built with React, TypeScript, Vite, and Supabase. The application helps students organize their courses, extract topics from syllabi using AI, and generate personalized study plans optimized for exam dates.

This document provides a comprehensive analysis of the project architecture and a prioritized plan to make it production-ready.

---

## 1. Project Architecture Overview

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI Framework |
| **Build Tool** | Vite | Fast development & bundling |
| **Styling** | Tailwind CSS + shadcn/ui | Design system |
| **State Management** | TanStack Query | Server state & caching |
| **Routing** | React Router v6 | Client-side navigation |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | Database, Auth, API |
| **AI Service** | Lovable AI Gateway (Gemini 2.5 Flash) | Topic extraction, OCR |
| **File Processing** | pdf.js (client-side) | PDF text extraction |

### 1.2 Directory Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # shadcn/ui primitives
│   ├── landing/     # Landing page sections
│   └── *.tsx        # Feature components
├── pages/           # Route pages
│   ├── Admin/       # Admin panel pages
│   └── *.tsx        # User-facing pages
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── integrations/    # Supabase client & types
├── lib/             # Utility functions
├── types/           # TypeScript definitions
└── data/            # Static data

supabase/
├── functions/       # Edge Functions (Deno)
│   ├── extract-topics/     # AI topic extraction
│   ├── generate-unified-plan/  # Study plan generation
│   ├── parse-pdf/          # PDF/image processing
│   ├── ocr-pages/          # OCR for scanned docs
│   ├── ingest-pdf-text/    # Text ingestion
│   ├── check-quota/        # Quota verification
│   ├── admin-*/            # Admin functions
│   └── google-calendar-*/  # Calendar integration
└── migrations/      # Database schema versions
```

---

## 2. Core Features & Business Logic

### 2.1 User Journey Flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│  Landing    │────▶│    Auth      │────▶│   Complete    │────▶│  Dashboard  │
│   Page      │     │  (Sign-up)   │     │   Profile     │     │             │
└─────────────┘     └──────────────┘     └───────────────┘     └──────┬──────┘
                                                                       │
        ┌──────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│   Create    │────▶│   Upload     │────▶│   Extract     │────▶│  Generate   │
│   Course    │     │   Files      │     │   Topics      │     │    Plan     │
└─────────────┘     └──────────────┘     └───────────────┘     └─────────────┘
```

### 2.2 Subject/Topic Extraction Pipeline

**File: `supabase/functions/extract-topics/index.ts`**

The AI topic extraction follows this flow:

```
Input Text ──▶ Truncation (30k chars) ──▶ AI Prompt ──▶ JSON Parse ──▶ Validation
                                            │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │  AI (Gemini 2.5 Flash) extracts:    │
                          │  - topic_key (t01, t02, ...)        │
                          │  - title                             │
                          │  - difficulty_weight (1-5)          │
                          │  - exam_importance (1-5)            │
                          │  - confidence_level                 │
                          │  - estimated_hours                  │
                          │  - prerequisites (DAG)              │
                          └─────────────────────────────────────┘
                                            │
                                            ▼
                          Validation ──▶ Cycle Detection ──▶ Insert to DB
```

**Key Features:**
- **Head + Tail Truncation**: Takes 60% from start, 40% from end to avoid bias
- **Comprehensive Validation**: Title length, weight ranges, enum values
- **Cycle Detection**: Detects and breaks prerequisite cycles using DFS
- **Idempotency**: Uses `extraction_run_id` to track provenance
- **Quota Enforcement**: Free plan limited to 50 topics, 3 AI extractions/month

### 2.3 Smart Plan Generation

**File: `supabase/functions/generate-unified-plan/index.ts`**

The planning algorithm:

```
1. Fetch all active courses with topics
2. Apply topological sort (Kahn's algorithm) per course
3. Calculate course priority = (1/daysUntilExam) × (totalHours + remainingTopics)
4. For each day until max exam date (capped at 90 days):
   a. Skip if day is in user's days_off
   b. Sort courses by exam proximity
   c. Allocate topics respecting:
      - Prerequisites must be scheduled before dependents
      - Daily study hours limit (from profile)
      - Topic estimated hours (can split across days)
   d. Create study_plan_days and study_plan_items records
```

**Time Distribution Logic:**
- Higher urgency courses (closer exams) get priority
- Difficult topics (higher difficulty_weight) get more hours
- Topics can be split across multiple days
- Review sessions can be scheduled (is_review flag)

### 2.4 Frontend Design Patterns

**State Management:**
- `useSubscription` - Tracks user plan, quotas, usage
- `usePlanGeneration` - Study plan CRUD operations
- `useCompletedTasks` - Task completion tracking
- `useLanguage` (Context) - i18n support (Arabic/English)

**Component Architecture:**
- Liquid glass design aesthetic with blur effects
- Responsive grid layouts
- RTL support for Arabic
- Skeleton loaders for async content
- Toast notifications (sonner)

---

## 3. Database Schema Analysis

### 3.1 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User settings | daily_study_hours, days_off, language |
| `courses` | Course metadata | title, exam_date, color, status |
| `topics` | Study topics | difficulty_weight, exam_importance, prerequisite_ids |
| `course_files` | Uploaded documents | extraction_status, extracted_text |
| `study_plan_days` | Daily plan structure | date, total_hours, is_day_off |
| `study_plan_items` | Plan items | topic_id, hours, is_completed |
| `ai_jobs` | AI operation log | job_type, status, result_json |
| `subscriptions` | User subscription | plan_id, status, trial_end |
| `plans` | Available plans | limits, features, pricing |
| `admin_overrides` | Manual quota overrides | quota_overrides, trial_extension_days |

### 3.2 Row Level Security (RLS)

Current RLS Implementation:
- ✅ All tables have RLS enabled
- ✅ User data scoped by `user_id = auth.uid()`
- ✅ Admin functions use service role key
- ⚠️ Need audit for edge cases in admin tables

---

## 4. Security Analysis

### 4.1 Current Security Measures

| Area | Implementation | Status |
|------|----------------|--------|
| **Authentication** | Supabase Auth (email/password) | ✅ Implemented |
| **Authorization** | RLS policies on all tables | ✅ Implemented |
| **Input Sanitization** | `lib/sanitize.ts` utilities | ✅ Implemented |
| **AI Prompt Injection** | Pattern removal in sanitize | ✅ Basic protection |
| **XSS Protection** | HTML escaping utility | ✅ Implemented |
| **File Validation** | Type & size checks | ✅ Implemented |
| **Admin Role Check** | `user_roles` table + RLS | ✅ Implemented |
| **API Key Protection** | Environment variables | ✅ Not exposed |

### 4.2 Security Gaps to Address

| Issue | Risk | Priority |
|-------|------|----------|
| No rate limiting on API endpoints | DoS vulnerability | P0 |
| Plaintext calendar tokens in DB | Token theft | P1 |
| No webhook signature verification | Spoofed webhooks | P1 |
| Missing CSP headers | XSS amplification | P2 |
| No audit logging | Incident investigation | P2 |

---

## 5. Production Readiness Plan

### Phase 1: Critical Security & Stability (Week 1-2)

#### P0-1: Environment Configuration
```yaml
Required Environment Variables:
  Frontend:
    - VITE_SUPABASE_URL
    - VITE_SUPABASE_PUBLISHABLE_KEY
    - VITE_SENTRY_DSN (new)
  
  Edge Functions:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - LOVABLE_API_KEY
    - STRIPE_SECRET_KEY (new)
    - STRIPE_WEBHOOK_SECRET (new)
    - SENTRY_DSN (new)
    - ENCRYPTION_KEY (new - for calendar tokens)
```

#### P0-2: Rate Limiting Implementation
```typescript
// Add to each Edge Function
const RATE_LIMITS = {
  'extract-topics': { requests: 10, window: '1h', key: 'user_id' },
  'generate-unified-plan': { requests: 20, window: '1h', key: 'user_id' },
  'parse-pdf': { requests: 30, window: '1h', key: 'user_id' },
};

// Use Supabase edge function with Redis/KV or in-DB tracking
```

#### P0-3: Webhook Security
```typescript
// Stripe webhook verification
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { 
  apiVersion: '2023-10-16' 
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const sig = req.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  await req.text(),
  sig,
  webhookSecret
);
```

#### P0-4: Token Encryption
```sql
-- Add encrypted columns to google_calendar_connections
ALTER TABLE google_calendar_connections 
ADD COLUMN encrypted_access_token TEXT,
ADD COLUMN encrypted_refresh_token TEXT,
ADD COLUMN encryption_version INTEGER DEFAULT 1;

-- Deprecate plaintext columns
```

### Phase 2: Observability & Monitoring (Week 2-3)

#### P1-1: Error Tracking Setup
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
});
```

#### P1-2: Structured Logging in Edge Functions
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  user_id?: string;
  course_id?: string;
  metadata?: Record<string, unknown>;
}

function log(entry: Omit<LogEntry, 'timestamp'>) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  }));
}
```

#### P1-3: Health Check Dashboard
- Existing: `admin-health-check` function
- Enhancement: Add uptime monitoring (e.g., Better Uptime, UptimeRobot)
- Metrics to track:
  - AI job success rate
  - Average extraction duration
  - Daily active users
  - Plan generation errors

### Phase 3: Stripe Production Integration (Week 3-4)

#### P2-1: Webhook Handler Implementation
```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16'
});
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  const event = stripe.webhooks.constructEvent(
    body, sig, STRIPE_WEBHOOK_SECRET
  );
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }
  
  return new Response(JSON.stringify({ received: true }));
});
```

#### P2-2: Subscription State Machine
```
                 ┌─────────────┐
                 │   trialing  │
                 └──────┬──────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  active  │  │  expired │  │ canceled │
    └────┬─────┘  └──────────┘  └──────────┘
         │
         ├────────────────┐
         ▼                ▼
   ┌──────────┐     ┌──────────┐
   │ past_due │────▶│ canceled │
   └──────────┘     └──────────┘
```

### Phase 4: Performance Optimization (Week 4-5)

#### P3-1: Database Indexing
```sql
-- Priority indexes
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_course_id ON topics(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_course ON ai_jobs(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_days_user_date ON study_plan_days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_day_id ON study_plan_items(plan_day_id);
```

#### P3-2: Query Optimization
```typescript
// Replace N+1 queries in usePlanGeneration.ts
// Current: Fetches items then loops to fetch course/topic for each
// Optimized: Single query with joins

const { data } = await supabase
  .from('study_plan_days')
  .select(`
    id, date, total_hours, is_day_off,
    study_plan_items (
      id, hours, order_index, is_completed,
      courses (id, title, color),
      topics (id, title, estimated_hours)
    )
  `)
  .eq('user_id', user.id)
  .gte('date', today)
  .order('date');
```

#### P3-3: AI Response Caching
```sql
-- Add caching table
CREATE TABLE ai_response_cache (
  input_hash TEXT PRIMARY KEY,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Edge function checks cache before calling AI
const cached = await supabase
  .from('ai_response_cache')
  .select('response_json')
  .eq('input_hash', hash)
  .gt('expires_at', new Date().toISOString())
  .single();

if (cached.data) return cached.data.response_json;
```

### Phase 5: CI/CD & Deployment (Week 5-6)

#### P4-1: GitHub Actions Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.STAGING_PROJECT_REF }}
      - run: supabase functions deploy --project-ref ${{ secrets.STAGING_PROJECT_REF }}

  deploy-production:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.PROD_PROJECT_REF }}
      - run: supabase functions deploy --project-ref ${{ secrets.PROD_PROJECT_REF }}
```

#### P4-2: Environment Strategy
| Environment | Branch | Supabase Project | Stripe Mode |
|-------------|--------|------------------|-------------|
| Development | feature/* | Local/Dev | Test |
| Staging | main | staging-project | Test |
| Production | tags/v* | prod-project | Live |

### Phase 6: Legal & Compliance (Week 6)

#### P5-1: Required Pages
- [x] Terms of Service (`/terms`) - Already exists
- [x] Privacy Policy (`/privacy`) - Already exists
- [ ] Cookie Policy (if analytics added)
- [ ] GDPR Data Processing Agreement

#### P5-2: User Data Controls
```typescript
// Already implemented:
// - supabase/functions/delete-account
// - supabase/functions/export-user-data

// Enhancements needed:
// 1. Add confirmation email before deletion
// 2. 30-day grace period with recovery option
// 3. Anonymize rather than hard delete for analytics
```

---

## 6. Testing Strategy

### 6.1 Recommended Test Structure
```
tests/
├── unit/
│   ├── lib/
│   │   ├── allocationEngine.test.ts
│   │   ├── sanitize.test.ts
│   │   └── pdfExtractor.test.ts
│   └── hooks/
│       └── useSubscription.test.ts
├── integration/
│   ├── auth.test.ts
│   ├── courses.test.ts
│   └── topics.test.ts
└── e2e/
    ├── onboarding.spec.ts
    ├── course-creation.spec.ts
    └── plan-generation.spec.ts
```

### 6.2 Critical Test Cases
| Feature | Test Case | Priority |
|---------|-----------|----------|
| Auth | Sign-up, login, password reset | P0 |
| Courses | Create, edit, delete with topics | P0 |
| Topics | AI extraction, manual add, edit | P0 |
| Plan Gen | Full generation with dependencies | P0 |
| Quotas | Free limit enforcement | P1 |
| Admin | Override creation, user management | P1 |

---

## 7. Go-Live Checklist

### Pre-Launch (T-7 days)
- [ ] All P0/P1 security items completed
- [ ] Staging environment fully tested
- [ ] Stripe Test Mode integration verified
- [ ] Error monitoring connected
- [ ] Database backups configured
- [ ] DNS/domain configured

### Launch Day (T-0)
- [ ] Switch Stripe to Live mode
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Test critical user flows
- [ ] Announce to users

### Post-Launch (T+7 days)
- [ ] Review error reports
- [ ] Analyze performance metrics
- [ ] Gather user feedback
- [ ] Plan iteration cycle

---

## 8. Cost Projections

### Infrastructure Costs (Estimated Monthly)

| Service | Free Tier | Growth (1k users) | Scale (10k users) |
|---------|-----------|-------------------|-------------------|
| Supabase | $0 | $25 | $75+ |
| AI API (Lovable) | $0 | ~$50-100 | ~$500+ |
| Error Tracking (Sentry) | $0 | $26 | $80+ |
| Uptime Monitoring | $0 | $0-20 | $50+ |
| **Total** | **$0** | **~$100-150** | **~$700+** |

### AI Cost Optimization
- Implement response caching (saves ~30-40% API calls)
- Truncate inputs intelligently
- Batch OCR requests
- Set hard quotas per user/plan

---

## 9. Recommendations Summary

### Immediate Actions (This Week)
1. ✅ Set up Sentry error tracking
2. ✅ Implement rate limiting on Edge Functions
3. ✅ Add database indexes for common queries
4. ✅ Encrypt calendar OAuth tokens

### Short-Term (Next 2 Weeks)
1. Complete Stripe webhook integration
2. Set up CI/CD pipeline
3. Create staging environment
4. Write critical E2E tests

### Medium-Term (Next Month)
1. Implement AI response caching
2. Add comprehensive audit logging
3. Set up automated backups
4. Improve PDF extraction accuracy

### Long-Term Enhancements
1. Mobile app (React Native)
2. Collaborative study groups
3. Spaced repetition integration
4. LMS integrations (Canvas, Blackboard)

---

## Appendix A: API Reference

### Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `extract-topics` | POST | Bearer | AI topic extraction |
| `generate-unified-plan` | POST | Bearer | Create/recreate study plan |
| `parse-pdf` | POST | Bearer | Process uploaded files |
| `ocr-pages` | POST | Bearer | OCR for scanned pages |
| `ingest-pdf-text` | POST | Bearer | Save extracted text |
| `check-quota` | POST | Bearer | Verify user quota |
| `google-calendar-auth` | POST | Bearer | OAuth flow |
| `sync-calendar` | POST | Bearer | Push events to GCal |
| `delete-account` | POST | Bearer | GDPR delete |
| `export-user-data` | POST | Bearer | GDPR export |
| `admin-stats` | POST | Admin | Dashboard metrics |
| `admin-health-check` | POST | Admin | System health |

### Request/Response Examples

<details>
<summary>Extract Topics</summary>

```json
// Request
POST /functions/v1/extract-topics
Authorization: Bearer <token>
{
  "courseId": "uuid",
  "text": "Week 1: Introduction...",
  "mode": "replace|append"
}

// Response
{
  "success": true,
  "job_id": "uuid",
  "topics_count": 12,
  "needs_review": false,
  "extraction_run_id": "uuid"
}
```
</details>

<details>
<summary>Generate Plan</summary>

```json
// Request
POST /functions/v1/generate-unified-plan
Authorization: Bearer <token>
{
  "mode": "full|recreate",
  "excludeCompleted": true
}

// Response
{
  "success": true,
  "plan_days": 30,
  "plan_items": 45,
  "plan_version": 2,
  "courses_included": [
    {
      "id": "uuid",
      "title": "Course Name",
      "days_left": 14,
      "remaining_topics": 8,
      "daily_hours": "2.5"
    }
  ]
}
```
</details>

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Author: Copilot Analysis*
