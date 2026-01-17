# StudyBuddy Agent Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend - Edge Functions](#backend---edge-functions)
5. [Frontend Structure](#frontend-structure)
6. [Key Features & Workflows](#key-features--workflows)
7. [Development Setup](#development-setup)
8. [Deployment & CI/CD](#deployment--cicd)
9. [Security & Compliance](#security--compliance)
10. [Operations & Monitoring](#operations--monitoring)
11. [API Reference](#api-reference)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

**StudyBuddy** is an AI-powered study planning platform designed to help students organize their coursework, extract topics from syllabi using AI, and generate personalized study plans.

### Purpose
- Help students manage multiple courses with different exam dates
- Extract study topics automatically from syllabi PDFs using AI
- Generate smart, personalized study schedules based on topics, exam dates, and student preferences
- Generate AI-powered quizzes to test knowledge
- Calculate grades with "what-if" scenarios and different aggregation rules
- Track progress with Pomodoro timer and completion tracking
- Optional Google Calendar integration for schedule syncing

### Target Users
- Students (primary users)
- Admins (for subscription and quota management)

### Tech Stack Summary
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **AI**: Google Gemini via Lovable AI Gateway
- **Payments**: Stripe (subscription management)
- **Error Tracking**: Sentry
- **Languages**: TypeScript (100%)
- **Testing**: Playwright for E2E tests

---

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   React SPA     │
│  (Vite + TS)    │
└────────┬────────┘
         │
         ├──── Supabase Client SDK
         │
┌────────▼────────────────────────────┐
│      Supabase Platform              │
│  ┌─────────────────────────────┐   │
│  │  PostgreSQL Database         │   │
│  │  (RLS Enabled)               │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Authentication (Auth)       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Storage (Syllabus PDFs)     │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Edge Functions (Deno)       │   │
│  │  ├─ extract-topics           │   │
│  │  ├─ generate-study-plan      │   │
│  │  ├─ stripe-webhook           │   │
│  │  ├─ google-calendar-auth     │   │
│  │  └─ admin-*                  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         ├──── Lovable AI Gateway ──── Google Gemini
         ├──── Stripe API
         └──── Google Calendar API
```

### Component Architecture

```
src/
├── pages/              # Route-level components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Courses.tsx     # Course management
│   ├── CourseDetail.tsx # Individual course view
│   ├── Plan.tsx        # Study plan view
│   ├── Schedule.tsx    # Calendar view
│   ├── Settings.tsx    # User settings
│   └── Admin/          # Admin panel pages
│       ├── Dashboard.tsx
│       ├── Users.tsx
│       ├── Plans.tsx
│       ├── Quotas.tsx
│       └── Trials.tsx
├── components/         # Reusable UI components
│   ├── Layout.tsx      # Main app layout
│   ├── FileUploadZone.tsx  # PDF upload
│   ├── PomodoroTimer.tsx   # Study timer
│   ├── CalendarSyncCard.tsx # Google Calendar integration
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts
│   ├── LanguageContext.tsx  # i18n (English/Arabic)
│   └── AuthContext.tsx      # Authentication state
├── hooks/              # Custom React hooks
│   ├── useSubscription.ts   # Subscription status
│   ├── usePlanGeneration.ts # AI plan generation
│   └── useStudySession.ts   # Pomodoro session tracking
├── integrations/
│   └── supabase/       # Supabase client & types
│       ├── client.ts
│       └── types.ts    # Auto-generated DB types
└── lib/                # Utilities
    └── utils.ts        # Helper functions
```

---

## Database Schema

### Core Tables

#### `profiles`
User profile information (one-to-one with `auth.users`)

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | FK to auth.users (PK) |
| email | TEXT | User email |
| display_name | TEXT | User's display name |
| language | TEXT | 'en' or 'ar' |
| is_disabled | BOOLEAN | Admin can disable accounts |
| created_at | TIMESTAMP | Account creation time |

#### `courses`
User's enrolled courses

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| title | TEXT | Course name (e.g., "Calculus II") |
| exam_date | DATE | Final exam date |
| color | TEXT | Hex color for UI |
| created_at | TIMESTAMP | Creation time |

#### `topics`
Study topics within courses (extracted from syllabi)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| course_id | UUID | FK to courses |
| user_id | UUID | FK to auth.users |
| title | TEXT | Topic name |
| description | TEXT | Topic description |
| difficulty_weight | INTEGER | 1-5 (AI estimated) |
| exam_importance | INTEGER | 1-5 (AI estimated) |
| estimated_hours | NUMERIC | Study time estimate |
| is_completed | BOOLEAN | User marked complete |
| prerequisites | TEXT[] | Array of topic_key dependencies |
| topic_key | TEXT | AI-generated key (t01, t02...) |
| source_file_id | UUID | FK to course_files |
| extraction_run_id | UUID | Groups topics from same extraction |
| confidence_level | TEXT | 'high', 'medium', 'low' |

#### `course_files`
Uploaded syllabus files

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| course_id | UUID | FK to courses |
| user_id | UUID | FK to auth.users |
| file_path | TEXT | Storage path |
| file_name | TEXT | Original filename |
| file_size | INTEGER | File size in bytes |
| extraction_status | TEXT | 'pending', 'extracting', 'extracted', 'failed', 'manual_required' |
| extracted_text | TEXT | Extracted content (max 100k chars) |
| extraction_run_id | UUID | Unique ID per extraction |
| extraction_method | TEXT | 'ai_vision', 'manual' |
| extraction_quality | TEXT | 'high', 'medium', 'low', 'failed' |
| extraction_metadata | JSONB | Processing details |

#### `study_plan_days`
Generated daily study schedules

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| plan_date | DATE | Study date |
| total_hours | NUMERIC | Total study hours for the day |
| day_type | TEXT | 'weekday', 'weekend', 'exam_day' |
| topics_snapshot_id | UUID | Hash of topic extraction run IDs |
| is_rest_day | BOOLEAN | Marked as rest day |

#### `study_plan_items`
Individual topic allocations within days

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| plan_day_id | UUID | FK to study_plan_days |
| topic_id | UUID | FK to topics |
| user_id | UUID | FK to auth.users |
| allocated_hours | NUMERIC | Hours allocated to this topic |
| sequence_order | INTEGER | Order within the day |
| topic_extraction_run_id | UUID | For stale plan detection |

### Subscription & Payment Tables

#### `subscriptions`
Stripe subscription tracking

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | FK to auth.users (PK) |
| status | TEXT | 'active', 'trialing', 'canceled', 'past_due' |
| plan_id | TEXT | 'free', 'pro' |
| stripe_customer_id | TEXT | Stripe customer ID |
| stripe_subscription_id | TEXT | Stripe subscription ID |
| current_period_end | TIMESTAMP | Subscription expiry |
| trial_end | TIMESTAMP | Trial expiry |
| last_webhook_at | TIMESTAMP | Last webhook received |

#### `plans`
Available subscription plans

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | 'free', 'pro' (PK) |
| name | TEXT | Display name |
| price_monthly | NUMERIC | Monthly price (USD) |
| max_courses | INTEGER | Course limit |
| max_topics_per_course | INTEGER | Topic limit |
| ai_extractions_per_month | INTEGER | AI quota |
| is_active | BOOLEAN | Plan availability |

#### `admin_overrides`
Admin-granted quota/plan overrides

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | FK to auth.users (PK) |
| subscription_override | TEXT | Force subscription status |
| quota_overrides | JSONB | Custom quotas |
| trial_extension_days | INTEGER | Extra trial days |
| notes | TEXT | Admin notes |
| created_by | UUID | Admin who created override |

### AI & Background Jobs

#### `ai_jobs`
Tracks async AI processing

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| course_id | UUID | FK to courses |
| job_type | TEXT | 'extract_topics', 'generate_plan' |
| status | TEXT | 'running', 'completed', 'needs_review', 'failed' |
| input_hash | TEXT | For deduplication |
| result | JSONB | Job result data |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMP | Job start time |
| updated_at | TIMESTAMP | Last status update |

#### `ai_response_cache`
Caches AI responses to reduce costs

| Column | Type | Description |
|--------|------|-------------|
| input_hash | TEXT | Hash of input (PK) |
| response | JSONB | Cached AI response |
| created_at | TIMESTAMP | Cache time |
| hit_count | INTEGER | Cache hit counter |

### Supporting Tables

#### `user_roles`
Admin role management

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| role | app_role | ENUM: 'admin', 'user' |

#### `webhook_events`
Stripe webhook idempotency tracking

| Column | Type | Description |
|--------|------|-------------|
| event_id | TEXT | Stripe event ID (PK) |
| event_type | TEXT | Webhook event type |
| processed_at | TIMESTAMP | Processing time |

#### `study_sessions`
Pomodoro session tracking

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| topic_id | UUID | FK to topics |
| duration_minutes | INTEGER | Session length |
| completed_at | TIMESTAMP | Session end time |

---

## Backend - Edge Functions

Edge Functions are deployed to Supabase and run on Deno runtime. All functions are located in `supabase/functions/`.

### Shared Utilities (`_shared/`)

#### `logger.ts`
Structured logging utility for consistent log formatting.

```typescript
// Usage:
logger.info('Processing topic extraction', { courseId, userId });
logger.error('AI call failed', { error: err.message });
```

#### `rate-limit.ts`
Rate limiting logic based on user subscription and quotas.

```typescript
// Check if user can perform action
await checkRateLimit(userId, 'ai_extraction');
```

#### `supabase-client.ts`
Supabase service role client for backend operations.

### Core Functions

#### `extract-topics`
**Path**: `/supabase/functions/extract-topics`  
**Purpose**: Extract study topics from syllabus text using AI  
**Auth**: Required (JWT)

**Input**:
```json
{
  "courseId": "uuid",
  "text": "syllabus content...",
  "fileId": "uuid (optional)",
  "mode": "replace | append",
  "extractionRunId": "uuid (optional)"
}
```

**Output**:
```json
{
  "topics_count": 15,
  "job_id": "uuid",
  "extraction_run_id": "uuid",
  "needs_review": false,
  "questions": [],
  "cycles_detected": false
}
```

**Features**:
- Async job processing via `ai_jobs` table
- Response caching (input hash deduplication)
- Rate limiting per user subscription
- Prerequisite cycle detection and repair
- Confidence scoring (high/medium/low)

#### `generate-study-plan` / `generate-unified-plan` / `generate-smart-plan`
**Purpose**: Generate personalized study schedules  
**Auth**: Required (JWT)

**Input**:
```json
{
  "courseId": "uuid (optional - for single course)",
  "preferences": {
    "daily_hours_weekday": 3,
    "daily_hours_weekend": 6,
    "exclude_dates": ["2024-01-15"],
    "focus_mode": "balanced | exam_focused"
  }
}
```

**Output**:
```json
{
  "plan_days": 30,
  "plan_items": 120,
  "plan_version": 2,
  "topics_snapshot_id": "uuid",
  "warnings": [],
  "validation_passed": true
}
```

**Features**:
- Multi-course scheduling support
- Prerequisite-aware ordering (DAG topological sort)
- Exam date constraints
- Custom daily hour allocations
- Stale plan detection via `topics_snapshot_id`

#### `parse-pdf` / `ingest-pdf-text` / `ocr-pages`
**Purpose**: Extract text from uploaded PDF files  
**Auth**: Required (JWT)

**Input**:
```json
{
  "fileId": "uuid"
}
```

**Output**:
```json
{
  "extraction_status": "extracted | failed | manual_required",
  "extracted_text": "...",
  "extraction_run_id": "uuid",
  "extraction_quality": "high | medium | low"
}
```

**Note**: Currently, PDFs are marked as `manual_required` pending proper PDF parsing implementation.

#### `stripe-webhook`
**Path**: `/supabase/functions/stripe-webhook`  
**Purpose**: Handle Stripe subscription webhooks  
**Auth**: Stripe signature verification

**Handled Events**:
- `checkout.session.completed` - New subscription
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Plan change
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Payment success
- `invoice.payment_failed` - Payment failure

**Features**:
- Idempotent processing via `webhook_events` table
- Updates `subscriptions` table
- Signature verification for security

#### `google-calendar-auth`
**Purpose**: OAuth flow for Google Calendar integration  
**Auth**: Required (JWT)

**Flow**:
1. Generate OAuth URL
2. User authorizes in Google
3. Exchange code for tokens
4. Store encrypted tokens in database

#### `sync-calendar`
**Purpose**: Sync study plan to Google Calendar  
**Auth**: Required (JWT)

**Features**:
- Creates calendar events for study sessions
- Bidirectional sync (optional)
- Updates existing events on plan changes

#### `analyze-past-exam`
**Purpose**: Analyze past exam papers to identify key topics and patterns
**Auth**: Required (JWT)

#### `analyze-topic`
**Purpose**: Deep analysis of a study topic
**Auth**: Required (JWT)

#### `generate-quiz`
**Purpose**: Generate quiz questions from course material
**Auth**: Required (JWT)

#### `submit-quiz-attempt`
**Purpose**: Submit and grade a quiz attempt
**Auth**: Required (JWT)

#### `get-yield-summary`
**Purpose**: Get study yield and efficiency metrics
**Auth**: Required (JWT)

### Admin Functions

#### `admin-health-check`
**Purpose**: System health monitoring  
**Auth**: Admin role required

**Output**:
```json
{
  "status": "healthy",
  "database": "connected",
  "ai_jobs_stuck": 0,
  "timestamp": "2024-01-14T10:00:00Z"
}
```

#### `admin-stats`
**Purpose**: Platform statistics for admin dashboard  
**Auth**: Admin role required

**Output**:
```json
{
  "total_users": 1250,
  "active_subscriptions": 340,
  "ai_jobs_last_24h": 450,
  "mrr": 3390.00
}
```

#### `check-quota`
**Purpose**: Check user's remaining quotas  
**Auth**: Required (JWT)

**Output**:
```json
{
  "courses_remaining": 2,
  "topics_remaining": 50,
  "ai_extractions_remaining": 8,
  "plan": "free"
}
```

#### `delete-account`
**Purpose**: GDPR-compliant account deletion  
**Auth**: Required (JWT)

**Features**:
- Cascading delete of all user data
- Cancels active subscriptions
- Removes files from storage
- Logs deletion event

#### `export-user-data`
**Purpose**: GDPR data export  
**Auth**: Required (JWT)

**Output**: JSON/PDF with all user data

---

## Frontend Structure

### Pages

#### Dashboard (`/`)
Main landing page after login. Shows:
- Course overview cards
- Upcoming exams countdown
- Overall progress statistics
- Quick actions (create course, upload syllabus)

#### Grade Calculator (`/grade-calculator`)
Advanced grade calculation tool:
- Calculate grades with custom weights
- Support for different aggregation rules (average, sum, drop lowest, best of)
- "What-if" analysis for target grades
- Save calculations (Pro feature)
- Curve adjustments and constraints

#### Courses (`/courses`)
Course management page:
- List all courses
- Create new course (dialog)
- Edit course details
- Delete course (with confirmation)
- Color-coded course cards

#### CourseDetail (`/courses/:id`)
Individual course view:
- Course metadata (title, exam date)
- File upload zone (syllabus PDFs)
- Topic extraction interface
- Topic list with completion tracking
- Progress visualization

#### Plan (`/plan`)
Study plan view:
- Generated study schedule (table/calendar format)
- Daily breakdown by course
- Hour allocations per topic
- Plan regeneration controls
- Stale plan warnings

#### Schedule (`/schedule`)
Calendar view:
- Weekly/monthly calendar grid
- Study sessions as events
- Google Calendar sync controls
- Drag-and-drop rescheduling (future)

#### Settings (`/settings`)
User settings:
- Profile information
- Language preference (EN/AR)
- Subscription management
- Google Calendar connection
- Account deletion

#### Other Pages
- **Auth**: Login and Signup
- **Landing**: Public landing page
- **Legal**: Privacy, Terms, Refund

#### Admin Panel (`/admin`)
Admin-only pages:
- **Dashboard**: System metrics, health checks
- **Users**: User management, subscription overrides
- **Plans**: Plan configuration (pricing, limits)
- **Quotas**: Custom quota assignments
- **Trials**: Trial extension management
- **Feedback**: User feedback review
- **Audit Log**: Track administrative actions
- **Credits**: Monitor credit usage and costs
- **Promos**: Manage promotional codes

### Key Components

#### `FileUploadZone.tsx`
Drag-and-drop PDF upload component with:
- File type validation (PDF only)
- Size limit enforcement (10MB)
- Upload progress indication
- Error handling
- Automatic extraction trigger

#### `PomodoroTimer.tsx`
Study session timer with:
- Configurable session length (default 25 min)
- Break reminders
- Session logging to database
- Topic association for tracking

#### `CalendarSyncCard.tsx`
Google Calendar integration UI:
- OAuth connection flow
- Sync status indicator
- Manual sync trigger
- Disconnect option

#### `PlanWarningBanner.tsx`
Alerts user to stale plans when:
- Topics have been modified
- New topics added
- Topics deleted
- Suggests plan regeneration

### Contexts

#### `LanguageContext`
Manages UI language (English/Arabic):
- Provides `t(key)` translation function
- Switches language globally
- Persists preference to database

#### `AuthContext` (via Supabase SDK)
Authentication state management:
- User session
- Login/logout
- Role checking (admin vs user)

### Hooks

#### `useSubscription`
Fetches user's subscription status:
```typescript
const { subscription, loading, isActive, isPro } = useSubscription();
```

#### `usePlanGeneration`
Handles plan generation workflow:
```typescript
const { generatePlan, loading, error } = usePlanGeneration();
await generatePlan({ courseId, preferences });
```

#### `useStudySession`
Manages Pomodoro sessions:
```typescript
const { startSession, endSession, currentSession } = useStudySession();
startSession(topicId);
```

---

## Key Features & Workflows

### 1. Course Creation Flow
1. User clicks "Create Course" button
2. Dialog opens with form (title, exam date, color)
3. Form validation (title required, date in future)
4. Submit → Insert into `courses` table
5. Redirect to course detail page

### 2. Topic Extraction Flow (AI-Powered)
1. User uploads PDF syllabus OR pastes text manually
2. File stored in Supabase Storage (`course_files` table entry)
3. **Async Processing**:
   - `extract-topics` Edge Function called
   - Creates `ai_jobs` entry (status: 'running')
   - AI analyzes text and extracts topics with:
     - Title, description
     - Difficulty weight (1-5)
     - Exam importance (1-5)
     - Estimated study hours
     - Prerequisites (topic dependencies)
4. **Validation & Repair**:
   - Prerequisite cycle detection
   - Duplicate topic detection
   - Low confidence flagging (`needs_review`)
5. Topics inserted into `topics` table with `extraction_run_id`
6. Job status updated to 'completed'
7. Frontend polls job status and displays topics

### 3. Study Plan Generation Flow
1. User clicks "Generate Plan"
2. Preferences dialog (daily hours, rest days, focus mode)
3. **AI Plan Generation**:
   - Fetches all courses with pending topics
   - Considers exam dates, prerequisites, topic difficulty
   - Generates DAG-based schedule (topological sort)
   - Validates:
     - No date conflicts
     - Prerequisites scheduled before dependents
     - All dates before exam dates
4. **Repair Loop** (if validation fails):
   - Sends errors back to AI for correction
   - Re-validates corrected schedule
   - Falls back to simpler algorithm if repair fails
5. Inserts into `study_plan_days` and `study_plan_items`
6. Frontend displays plan with daily breakdown

### 4. Progress Tracking Flow
1. User views plan/schedule page
2. Clicks "Mark Complete" on a topic
3. Updates `topics.is_completed = true`
4. Logs study session to `study_sessions` (if Pomodoro used)
5. Recalculates progress percentages
6. Updates UI (progress bars, course cards)

### 5. Subscription Flow (Stripe)
1. User clicks "Upgrade to Pro"
2. Redirected to Stripe Checkout
3. User completes payment
4. **Stripe Webhook** (`checkout.session.completed`):
   - Verifies signature
   - Creates/updates `subscriptions` entry
   - Sets `status = 'active'`
5. Frontend detects subscription change
6. Unlocks Pro features (unlimited courses/topics)

### 6. Google Calendar Sync Flow
1. User clicks "Connect Google Calendar"
2. OAuth flow:
   - `google-calendar-auth` generates auth URL
   - User authorizes in Google
   - Tokens encrypted and stored in DB
3. User clicks "Sync Plan"
4. `sync-calendar` Edge Function:
   - Fetches study plan items
   - Creates/updates Google Calendar events
   - Stores event IDs for bidirectional sync
5. Future updates to plan auto-sync (optional)

### 7. Grade Calculation Flow
1. User navigates to Grade Calculator
2. Adds components (Midterm, Final, Homework, etc.)
3. Sets weights and max scores
4. Enters raw scores for graded items
5. Defines aggregation rules (e.g., "Best 5 of 6 quizzes")
6. **What-If Analysis**:
   - Sets target grade (e.g., 90%)
   - Calculator determines required score on remaining items
7. **Saving (Pro)**:
   - User saves calculation profile
   - Saved to `grade_calculations` table

### 8. Quiz Generation Flow
1. User selects a topic or course
2. Clicks "Generate Quiz"
3. `generate-quiz` Edge Function:
   - Analyzes course content/topics
   - Generates questions (MCQ, Open-ended)
   - Stores quiz in database
4. User takes quiz
5. Submits answers -> `submit-quiz-attempt`
6. View results and explanations

---

## Development Setup

### Prerequisites
- **Node.js**: v20+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **Package Manager**: npm or bun
- **Supabase CLI**: For local development and migrations
- **Git**: For version control

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/studybuddy.git
cd studybuddy-bright

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see below)
# Edit .env.local with your Supabase project details
```

### Environment Configuration

Create `.env.local` with:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_ID"

# Sentry (Optional for local dev, required for production)
VITE_SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
```

### Edge Function Secrets

Configure in Supabase Dashboard or via CLI:

```bash
# Stripe (for payment processing)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# AI API (for topic extraction)
supabase secrets set LOVABLE_API_KEY=your-api-key

# Google Calendar OAuth (optional)
supabase secrets set GOOGLE_CLIENT_ID=your-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
supabase secrets set TOKEN_ENCRYPTION_KEY=your-32-byte-hex-key
```

### Local Development

```bash
# Start development server
npm run dev

# App will be available at http://localhost:5173
```

### Database Setup

```bash
# Link to Supabase project
supabase link --project-ref YOUR_PROJECT_ID

# Pull remote schema (first time)
supabase db pull

# Or apply migrations to remote
supabase db push
```

### Running Supabase Locally (Optional)

```bash
# Start local Supabase stack (requires Docker)
supabase start

# Update .env.local to use local URLs
VITE_SUPABASE_URL="http://localhost:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="local-anon-key"
```

### Development Scripts

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Run E2E tests
npx playwright test
```

### Creating Database Migrations

```bash
# Create new migration file
supabase migration new migration_name

# Edit the generated SQL file in supabase/migrations/

# Apply migration to local DB
supabase db reset

# Or apply to remote
supabase db push
```

---

## Deployment & CI/CD

### Environments

| Environment | Branch/Tag | Purpose | Stripe Mode |
|-------------|-----------|---------|-------------|
| **Development** | Local | Development & testing | Test Mode |
| **Staging** | `main` branch | Pre-production QA | Test Mode |
| **Production** | `v*.*.*` tags | Live environment | Live Mode |

### CI/CD Pipeline (GitHub Actions)

Located in `.github/workflows/deploy.yml`

#### Pull Request Workflow
- Runs ESLint (`npm run lint`)
- Runs build check (`npm run build`)
- Runs E2E tests (if configured)

#### Main Branch (Staging Deploy)
On push to `main`:
1. Build frontend (`npm run build`)
2. Deploy to Supabase Staging project
3. Run database migrations (`supabase db push`)
4. Deploy Edge Functions (`supabase functions deploy`)

#### Tagged Release (Production Deploy)
On tag `v*.*.*`:
1. Build frontend with production config
2. Deploy to Supabase Production project
3. Run migrations (safe, versioned)
4. Deploy Edge Functions
5. Update Stripe webhook endpoints (if needed)

### Manual Deployment

#### Staging
```bash
# Set environment
export SUPABASE_PROJECT_REF="your-staging-ref"

# Build
npm run build

# Deploy database
supabase db push --project-ref $SUPABASE_PROJECT_REF

# Deploy Edge Functions
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF
```

#### Production
```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will auto-deploy
# Or manually:
export SUPABASE_PROJECT_REF="your-production-ref"
npm run build
supabase db push --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF
```

### Rollback Procedure

```bash
# Revert code
git revert <commit-hash>
git push origin main

# Or redeploy previous tag
git checkout v1.0.0
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF

# Database rollback (use Supabase PITR)
# Contact Supabase support or use Dashboard
```

---

## Security & Compliance

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

#### Profiles
```sql
-- Users can only view/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
```

#### Courses
```sql
-- Users can only access their own courses
CREATE POLICY "Users own courses"
  ON courses FOR ALL
  USING (auth.uid() = user_id);
```

#### Topics
```sql
-- Users can only access topics in their courses
CREATE POLICY "Users own topics"
  ON topics FOR ALL
  USING (auth.uid() = user_id);
```

#### Admin Overrides
```sql
-- Users can only view their own overrides
-- Only admins can modify
CREATE POLICY "Users view own overrides"
  ON admin_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage overrides"
  ON admin_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Storage Security

**Buckets**: Private by default

**Policies**:
```sql
-- Users can only upload to their own folder
CREATE POLICY "Users upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only access their own files
CREATE POLICY "Users access own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

**File Constraints**:
- Max size: 10MB
- Allowed types: PDF, TXT
- Served via signed URLs (5-minute expiration)

### Input Sanitization

**User-Provided Text**:
- Syllabus content: Sanitized before rendering
- Course/topic titles: XSS protection via React's escaping
- AI prompts: Strict validation to prevent prompt injection

**Best Practices**:
- Never use `dangerouslySetInnerHTML` without sanitization
- Validate all user input server-side (Edge Functions)
- Use parameterized queries (Supabase SDK handles this)

### Secrets Management

**Never Commit**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `LOVABLE_API_KEY`
- `GOOGLE_CLIENT_SECRET`

**Storage**:
- Edge Function secrets: Supabase Dashboard → Settings → Edge Functions
- Frontend: Only `VITE_*` prefixed vars (public, safe to expose)

### Authentication

**Supabase Auth**:
- Email/password authentication
- JWT-based sessions
- Automatic session refresh
- Secure cookie storage

**Admin Role Verification**:
- Always verified server-side via `user_roles` table
- RLS policies enforce role checks
- Never trust client-side role state

### GDPR Compliance

**Data Deletion**:
- `delete-account` Edge Function handles cascading deletes
- Removes: profile, courses, topics, plans, sessions, files
- Cancels subscriptions
- Logs deletion event

**Data Export**:
- `export-user-data` provides JSON/PDF export
- Includes all user data (courses, topics, plans, sessions)

**Legal Pages**:
- Terms of Service: `/terms`
- Privacy Policy: `/privacy`

---

## Operations & Monitoring

### Error Tracking (Sentry)

**Frontend**: Initialized in `src/main.tsx`
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1,
  environment: import.meta.env.MODE
});
```

**Backend**: Structured logging in Edge Functions
```typescript
// _shared/logger.ts
logger.error('AI extraction failed', {
  userId,
  courseId,
  error: err.message
});
```

### Logging Best Practices

**What to Log**:
- AI job start/completion
- Payment events (success/failure)
- Admin actions (role changes, overrides)
- Rate limit triggers
- Authentication failures

**What NOT to Log**:
- User passwords
- Full syllabus content (only length/hash)
- Stripe secret keys
- PII unless necessary

### Monitoring Queries

See `docs/RUNBOOKS.md` for detailed queries.

**Daily Health Check**:
```sql
-- Active users in last 24h
SELECT COUNT(DISTINCT user_id) FROM ai_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Failed jobs in last 24h
SELECT COUNT(*) FROM ai_jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours';
```

**Weekly Metrics**:
```sql
-- MRR estimate
SELECT COUNT(*) * 9.99 as estimated_mrr
FROM subscriptions
WHERE status = 'active';

-- User growth
SELECT DATE_TRUNC('week', created_at) as week, COUNT(*) as new_users
FROM profiles
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY week;
```

### Incident Response

See `docs/RUNBOOKS.md` for detailed procedures:
1. **Stuck AI Jobs**: Mark as failed after 5 minutes
2. **Stripe Webhook Failures**: Replay from Stripe Dashboard
3. **Database Restore**: Use Supabase PITR (Point-in-Time Recovery)
4. **Rate Limit Issues**: Grant temporary overrides or disable abusive users
5. **Emergency Procedures**: Disable functions, roll back deployments

---

## API Reference

### REST Endpoints (Supabase)

All database operations use Supabase client SDK (REST API under the hood).

**Authentication**:
```typescript
import { supabase } from '@/integrations/supabase/client';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Sign out
await supabase.auth.signOut();
```

**Database Queries**:
```typescript
// Fetch courses
const { data: courses } = await supabase
  .from('courses')
  .select('*')
  .order('exam_date', { ascending: true });

// Insert course
const { data: newCourse } = await supabase
  .from('courses')
  .insert({ title: 'Math 101', exam_date: '2024-05-15', color: '#3b82f6' })
  .select()
  .single();

// Update topic
await supabase
  .from('topics')
  .update({ is_completed: true })
  .eq('id', topicId);

// Delete course (cascade handled by DB)
await supabase
  .from('courses')
  .delete()
  .eq('id', courseId);
```

### Edge Function Endpoints

Base URL: `https://YOUR_PROJECT.supabase.co/functions/v1/`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### POST /extract-topics
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/extract-topics \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "uuid",
    "text": "Chapter 1: Introduction to Calculus..."
  }'
```

#### POST /generate-study-plan
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-study-plan \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "uuid",
    "preferences": {
      "daily_hours_weekday": 3,
      "daily_hours_weekend": 6
    }
  }'
```

#### POST /stripe-webhook
```bash
# Called by Stripe (signature verification required)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook \
  -H "Stripe-Signature: $SIGNATURE" \
  -d @webhook_payload.json
```

#### GET /admin-stats
```bash
curl -X GET https://YOUR_PROJECT.supabase.co/functions/v1/admin-stats \
  -H "Authorization: Bearer $ADMIN_JWT"
```

---

## Troubleshooting

### Common Issues

#### "Topics not extracting from PDF"
**Cause**: PDFs currently marked as `manual_required` (vision API limitation)  
**Solution**: Copy/paste text manually from PDF

**Future Fix**: Implement proper PDF text extraction (pdf-parse library)

#### "Stuck AI Jobs"
**Symptoms**: Extraction shows "in progress" indefinitely  
**Diagnosis**:
```sql
SELECT * FROM ai_jobs
WHERE status = 'running'
AND created_at < NOW() - INTERVAL '5 minutes';
```
**Solution**: See `docs/RUNBOOKS.md` → "Stuck AI Jobs"

#### "Plan shows as stale"
**Cause**: Topics were modified/added after plan generation  
**Explanation**: `topics_snapshot_id` detects changes to topic extraction runs  
**Solution**: Regenerate plan (click "Generate New Plan")

#### "Subscription not updating after payment"
**Cause**: Stripe webhook failure or delay  
**Diagnosis**:
```sql
SELECT * FROM subscriptions WHERE user_id = '<USER_ID>';
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;
```
**Solution**: 
1. Check Stripe Dashboard for webhook delivery status
2. Replay webhook if failed
3. Manual update if needed (see `docs/RUNBOOKS.md`)

#### "Admin link not showing"
**Cause**: User not in `user_roles` table or needs to re-login  
**Solution**:
```sql
-- Verify admin role
SELECT * FROM user_roles WHERE user_id = '<USER_ID>';

-- Add admin role if missing
INSERT INTO user_roles (user_id, role)
VALUES ('<USER_ID>', 'admin');
```
Then log out and back in.

#### "Rate limit exceeded"
**Cause**: User exceeded AI extraction quota  
**Solution**: 
1. Check quota: Call `/check-quota` endpoint
2. Wait for monthly reset (free plan)
3. Upgrade to Pro
4. Admin can grant temporary override (see `docs/RUNBOOKS.md`)

### Debug Mode

**Enable verbose logging**:
```typescript
// In Edge Function
const DEBUG = Deno.env.get('DEBUG') === 'true';
if (DEBUG) {
  console.log('Detailed debug info:', { ... });
}
```

**Check logs**:
- Supabase Dashboard → Logs → Edge Functions
- Filter by function name
- Search for error messages

### Database Issues

**Connection errors**:
- Verify `VITE_SUPABASE_URL` in `.env.local`
- Check network connectivity
- Verify Supabase project is not paused (free tier auto-pauses)

**RLS policy errors**:
- Common error: `new row violates row-level security policy`
- Cause: User doesn't own the resource
- Solution: Verify ownership in SQL:
```sql
SELECT user_id FROM courses WHERE id = '<COURSE_ID>';
```

**Migration conflicts**:
```bash
# Reset local database (WARNING: destroys local data)
supabase db reset

# Or pull remote schema
supabase db pull
```

### Performance Issues

**Slow queries**:
- Add indexes on frequently queried columns
- Example:
```sql
CREATE INDEX idx_topics_course_id ON topics(course_id);
CREATE INDEX idx_topics_user_id ON topics(user_id);
```

**Large AI responses**:
- Current limit: 100k chars per extracted text
- Solution: Truncate or summarize input before sending to AI

---

## Additional Resources

### Documentation Files
- [README.md](./README.md) - Project overview and quick start
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Production checklist and standards
- [SUPER_ADMIN.md](./SUPER_ADMIN.md) - Admin management guide
- [docs/RUNBOOKS.md](./docs/RUNBOOKS.md) - Operational procedures
- [docs/PIPELINE_CONTRACT.md](./docs/PIPELINE_CONTRACT.md) - AI pipeline contracts and invariants
- [docs/ANALYSIS_AND_PRODUCTION_PLAN.md](./docs/ANALYSIS_AND_PRODUCTION_PLAN.md) - Architecture analysis

### External Links
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Tailwind CSS](https://tailwindcss.com/)

### Support Contacts
- **Supabase Support**: support@supabase.io
- **Stripe Support**: Via Stripe Dashboard → Help
- **Sentry Issues**: Check Sentry Dashboard for error tracking

---

## Changelog

### Production Ready (Phase 3 Completed)
- ✅ Multi-environment setup (Dev/Staging/Prod)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ RLS security audit and enforcement
- ✅ Async AI job processing
- ✅ Stripe webhook integration
- ✅ Sentry error tracking
- ✅ Legal pages (Terms, Privacy)
- ✅ Admin panel with role management
- ✅ GDPR compliance (delete account, export data)
- ✅ Rate limiting and quota enforcement
- ✅ Response caching for AI calls
- ✅ Operations runbooks

### Known Limitations
- PDF text extraction currently requires manual input
- No mobile app (responsive web only)
- Google Calendar sync is one-way (plan → calendar)
- Arabic UI translation incomplete (some strings English-only)

### Roadmap
- Proper PDF parsing (pdf-parse or similar)
- Bidirectional Google Calendar sync
- Mobile app (React Native)
- Complete Arabic localization
- Advanced analytics dashboard
- Team/class collaboration features
- Custom AI model fine-tuning

---

**Last Updated**: 2026-01-14  
**Version**: 1.0.0  
**Maintained By**: StudyBuddy Development Team
