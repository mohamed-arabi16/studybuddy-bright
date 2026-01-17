# StudyBuddy E2E Test Specification Package

**Version:** 1.0  
**Date:** January 2026  
**Application:** StudyBuddy
**Purpose:** Comprehensive End-to-End Testing Documentation for Pre-Production Deployment

---

## A) SYSTEM OVERVIEW

### A.1 Application Purpose

StudyBuddy is an AI-powered study planning SaaS application designed to help students:
- Organize courses with exam dates
- Upload syllabi and course materials (PDF, images)
- Extract study topics using AI (Gemini via Lovable AI Gateway)
- Generate personalized, optimized study plans
- Track progress with Pomodoro timer integration
- Sync study schedules to Google Calendar

### A.2 Environments & Test Strategy

| Environment | Branch/Trigger | Purpose | Stripe Mode | Database |
|-------------|----------------|---------|-------------|----------|
| **Development** | Local / feature/* | Local testing | N/A | Local Supabase |
| **Staging** | main branch | QA & Integration Testing | Test Mode | Staging Supabase Project |
| **Production** | v*.*.* tags | Live Users | Live Mode | Production Supabase Project |

**Test Strategy Assumptions:**
- E2E tests run against Staging environment
- Tests use dedicated test accounts (not production data)
- Stripe integration tests use Test Mode API keys
- AI tests may be mocked for reliability (actual AI has latency)
- Database is seeded with known test data before test runs
- Tests clean up created data after execution

### A.3 Roles & Permission Boundaries

| Role | Description | Key Permissions | UI Access |
|------|-------------|-----------------|-----------|
| **Anonymous** | Unauthenticated visitor | View landing, terms, privacy | `/`, `/terms`, `/privacy`, `/auth` |
| **User (Free)** | Registered free-tier user | Create courses (3 max), topics (50 max), AI extractions (3/month) | `/app/*` (all user routes) |
| **User (Pro)** | Paid subscription user | Unlimited courses, topics, AI extractions, calendar sync | `/app/*` (all user routes) |
| **User (Trial)** | Pro features during trial | Same as Pro (time-limited) | `/app/*` (all user routes) |
| **Admin** | Super admin via `user_roles` table | All user capabilities + admin panel access | `/app/*`, `/admin/*` |

**Permission Matrix (RLS-Enforced):**

| Resource | Anonymous | User | Admin |
|----------|-----------|------|-------|
| Own courses | ❌ | ✅ CRUD | ✅ CRUD |
| Other's courses | ❌ | ❌ | ❌ (RLS blocks) |
| Own topics | ❌ | ✅ CRUD | ✅ CRUD |
| Own plan items | ❌ | ✅ CRUD | ✅ CRUD |
| Own profile | ❌ | ✅ RU | ✅ RU |
| All profiles | ❌ | ❌ | ✅ R (admin_stats) |
| User roles | ❌ | ❌ | ✅ CRUD |
| Admin overrides | ❌ | ❌ | ✅ CRUD |
| Plans | ❌ | ✅ R (active only) | ✅ RU |
| Promo codes | ❌ | ❌ | ✅ CRUD |
| Feedback | ❌ | ✅ C (own) | ✅ RU (all) |

### A.4 Core Entities/Objects

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `profiles` | User profile data | user_id, email, full_name, display_name, university, department, daily_study_hours, days_off, language, is_disabled |
| `courses` | Study courses | user_id, title, exam_date, color, status |
| `topics` | Study topics per course | course_id, user_id, title, difficulty_weight, exam_importance, estimated_hours, prerequisite_ids, status, is_completed |
| `course_files` | Uploaded documents | course_id, user_id, file_name, file_path, extraction_status, extracted_text |
| `study_plan_days` | Daily study plan | user_id, date, total_hours, is_day_off, plan_version |
| `study_plan_items` | Individual study tasks | plan_day_id, topic_id, course_id, hours, is_completed, order_index |
| `ai_jobs` | AI operation tracking | user_id, course_id, job_type, status, result_json, error_message |
| `subscriptions` | User subscription | user_id, plan_id, status, stripe_customer_id, trial_end, current_period_end |
| `plans` | Subscription plans | name, price_monthly, price_yearly, limits, features, is_active |
| `admin_overrides` | Manual quota overrides | user_id, quota_overrides, trial_extension_days, created_by, notes |
| `promo_codes` | Promotional codes | code, trial_days, max_redemptions, current_redemptions, is_active, expires_at |
| `promo_redemptions` | Code redemption records | user_id, promo_code_id, trial_days_granted |
| `user_roles` | Admin role assignments | user_id, role (admin/user) |
| `feedback` | User feedback submissions | user_id, message, feedback_type, rating, status, admin_notes |
| `pomodoro_sessions` | Focus session tracking | user_id, topic_id, duration_minutes, session_type, completed_at |
| `google_calendar_connections` | OAuth tokens for calendar sync | user_id, access_token, refresh_token, calendar_id, is_active |

---

## B) ACTION INVENTORY (MASTER MATRIX)

### B.1 Authentication Module (AUTH)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-AUTH-001 | Anonymous | Auth | Sign Up with Email | None | Account created, verification email sent | Toast success, profile created | P0 | High |
| U-AUTH-002 | Anonymous | Auth | Sign In with Email | Valid account exists | User logged in, redirected to dashboard | Session established, nav shows user | P0 | High |
| U-AUTH-003 | Anonymous | Auth | Sign Up/In with Google OAuth | None | Account created/logged in via Google | OAuth flow completes, profile created | P0 | High |
| U-AUTH-004 | User | Auth | Sign Out | Logged in | Session destroyed, redirected to landing | No session, restricted routes blocked | P0 | Med |
| U-AUTH-005 | Anonymous | Auth | Request Password Reset | Account exists | Reset email sent | Toast confirmation | P1 | Med |
| U-AUTH-006 | Anonymous | Auth | Reset Password via Link | Valid reset token | Password updated, can sign in | New password works | P1 | High |
| U-AUTH-007 | User | Auth | Update Password | Logged in | Password changed | Can sign in with new password | P1 | Med |

### B.2 Profile Module (PROFILE)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-PROF-001 | User | Profile | Complete Profile (Post-OAuth) | Google sign-in, profile incomplete | Profile completed, redirected to dashboard | Profile fields saved to DB | P0 | High |
| U-PROF-002 | User | Profile | Update Profile Information | Logged in | Profile updated | Changes persisted, toast success | P1 | Low |
| U-PROF-003 | User | Profile | Update Study Preferences | Logged in | Preferences saved | daily_study_hours, days_off updated | P1 | Low |
| U-PROF-004 | User | Profile | Change Language | Logged in | UI language changed | Local storage + profile updated | P2 | Low |
| U-PROF-005 | User | Profile | Export My Data | Logged in | JSON file downloaded | Contains all user data | P1 | Med |
| U-PROF-006 | User | Profile | Delete Account | Logged in, password confirmed | Account deleted, signed out | All user data removed | P0 | High |

### B.3 Course Management Module (COURSE)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-CRS-001 | User | Course | Create Course | Logged in, within quota | Course created | Course in list, toast success | P0 | Med |
| U-CRS-002 | User | Course | View Course List | Logged in | Courses displayed | Only user's courses shown | P0 | Low |
| U-CRS-003 | User | Course | View Course Detail | Course exists, owned | Course detail page shown | Correct course data, tabs work | P0 | Low |
| U-CRS-004 | User | Course | Edit Course | Course owned | Course updated | Changes persisted | P1 | Low |
| U-CRS-005 | User | Course | Delete Course | Course owned | Course deleted with topics | Course removed, topics cascade deleted | P0 | Med |
| U-CRS-006 | User | Course | Upload File to Course | Course owned, file valid | File uploaded, processing starts | File in storage, status pending/extracting | P0 | Med |
| U-CRS-007 | User | Course | Delete File from Course | File owned | File removed | Storage cleaned, DB record deleted | P1 | Low |
| U-CRS-008 | User | Course | Retry File Extraction | File in failed/manual_required state | Re-extraction triggered | Status updates, text extracted | P1 | Med |

### B.4 Topic Management Module (TOPIC)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-TOP-001 | User | Topic | AI Extract Topics from File | File extracted, within AI quota | Topics created from AI analysis | Topics in list, extraction_run_id set | P0 | High |
| U-TOP-002 | User | Topic | Add Topic Manually | Course owned, within quota | Topic created | Topic in list | P1 | Low |
| U-TOP-003 | User | Topic | Edit Topic | Topic owned | Topic updated | Changes persisted | P1 | Low |
| U-TOP-004 | User | Topic | Delete Topic | Topic owned | Topic removed | Topic deleted from DB | P1 | Low |
| U-TOP-005 | User | Topic | Mark Topic Complete | Topic owned | Topic marked done | is_completed=true, completed_at set | P0 | Low |
| U-TOP-006 | User | Topic | Mark Topic Incomplete | Topic owned, is_completed | Topic unmarked | is_completed=false | P1 | Low |

### B.5 Study Plan Module (PLAN)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-PLN-001 | User | Plan | Generate Study Plan | Has courses with topics+exam dates | Plan created with daily items | study_plan_days/items created | P0 | High |
| U-PLN-002 | User | Plan | View Study Plan | Plan exists | Plan displayed by day | All days/items shown correctly | P0 | Low |
| U-PLN-003 | User | Plan | Recreate/Replan | Plan exists, missed items | Plan regenerated | Old plan replaced, new items created | P1 | Med |
| U-PLN-004 | User | Plan | Complete Plan Item | Plan item exists | Item marked done | is_completed=true | P0 | Low |
| U-PLN-005 | User | Plan | Uncomplete Plan Item | Plan item completed | Item marked incomplete | is_completed=false | P1 | Low |

### B.6 Dashboard Module (DASH)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-DSH-001 | User | Dashboard | View Dashboard | Logged in | Dashboard displayed | Greeting, exams, today's plan shown | P0 | Low |
| U-DSH-002 | User | Dashboard | Start Pomodoro Session | Logged in | Timer starts | UI updates, countdown begins | P1 | Low |
| U-DSH-003 | User | Dashboard | Complete Pomodoro Session | Timer running | Session recorded | pomodoro_sessions entry created | P1 | Low |
| U-DSH-004 | User | Dashboard | Sync to Google Calendar | Calendar connected | Events synced | Toast with count, calendar updated | P1 | Med |

### B.7 Settings & Subscription Module (SET)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-SET-001 | User | Settings | View Subscription Status | Logged in | Current plan displayed | Plan name, limits shown | P0 | Low |
| U-SET-002 | User | Settings | Redeem Promo Code | Valid code, not already redeemed | Trial extended | trial_end updated, toast success | P1 | Med |
| U-SET-003 | User | Settings | Request Upgrade (Contact) | Free user | Contact dialog shown | ASSUMPTION: Triggers contact flow | P2 | Low |
| U-SET-004 | User | Settings | Connect Google Calendar | Logged in | OAuth flow initiated | Redirects to Google, callback handled | P1 | Med |
| U-SET-005 | User | Settings | Disconnect Google Calendar | Calendar connected | Connection removed | Tokens deleted, is_active=false | P1 | Low |
| U-SET-006 | User | Settings | Toggle Calendar Auto-Sync | Calendar connected | Auto-sync toggled | auto_sync field updated | P2 | Low |

### B.8 Feedback Module (FEED)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| U-FEED-001 | User | Feedback | Submit Feedback | Logged in | Feedback recorded | feedback entry created | P2 | Low |

### B.9 Admin - User Management (A-USR)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| A-USR-001 | Admin | Admin/Users | View All Users | Admin role | User list displayed | All profiles shown | P0 | Med |
| A-USR-002 | Admin | Admin/Users | Search Users | Admin role | Filtered user list | Search by email/name works | P1 | Low |
| A-USR-003 | Admin | Admin/Users | Grant Pro Access | Admin role, user exists | User has Pro override | quota_overrides set | P0 | High |
| A-USR-004 | Admin | Admin/Users | Extend User Trial | Admin role, user exists | Trial extended | trial_extension_days updated | P0 | High |
| A-USR-005 | Admin | Admin/Users | Set Custom Quotas | Admin role, user exists | Custom limits applied | quota_overrides saved | P1 | Med |
| A-USR-006 | Admin | Admin/Users | Reset User to Free | Admin role, user has override | Override removed | admin_overrides deleted | P1 | Med |
| A-USR-007 | Admin | Admin/Users | Promote to Admin | Admin role, target is user | User becomes admin | user_roles entry created | P0 | High |
| A-USR-008 | Admin | Admin/Users | Demote from Admin | Admin role, target is admin | User demoted | user_roles entry deleted | P0 | High |
| A-USR-009 | Admin | Admin/Users | Disable User Account | Admin role | User cannot log in | is_disabled=true | P0 | High |
| A-USR-010 | Admin | Admin/Users | Enable User Account | Admin role, user disabled | User can log in | is_disabled=false | P1 | Med |

### B.10 Admin - Plans Management (A-PLN)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| A-PLN-001 | Admin | Admin/Plans | View All Plans | Admin role | Plans displayed | All plans shown with limits | P1 | Low |
| A-PLN-002 | Admin | Admin/Plans | Edit Plan Limits | Admin role, plan exists | Plan limits updated | limits JSON updated | P1 | High |
| A-PLN-003 | Admin | Admin/Plans | Edit Plan Pricing | Admin role, plan exists | Pricing updated | price_monthly/yearly updated | P1 | High |

### B.11 Admin - Promo Codes (A-PRM)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| A-PRM-001 | Admin | Admin/Promos | View All Promo Codes | Admin role | Codes displayed | All codes shown | P1 | Low |
| A-PRM-002 | Admin | Admin/Promos | Create Promo Code | Admin role | Code created | promo_codes entry created | P0 | Med |
| A-PRM-003 | Admin | Admin/Promos | Activate/Deactivate Code | Admin role, code exists | Status toggled | is_active updated | P1 | Med |
| A-PRM-004 | Admin | Admin/Promos | Update Max Redemptions | Admin role, code exists | Limit updated | max_redemptions updated | P2 | Low |
| A-PRM-005 | Admin | Admin/Promos | Delete Promo Code | Admin role, code exists | Code deleted | promo_codes entry removed | P1 | Med |

### B.12 Admin - Dashboard & Stats (A-DSH)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| A-DSH-001 | Admin | Admin/Dashboard | View Admin Dashboard | Admin role | Stats displayed | User counts, AI jobs, charts | P0 | Low |
| A-DSH-002 | Admin | Admin/Dashboard | View System Health | Admin role | Health status shown | DB, AI, Storage status | P1 | Low |
| A-DSH-003 | Admin | Admin/Dashboard | Refresh Stats | Admin role | Data refreshed | Updated counts | P2 | Low |

### B.13 Admin - Feedback Management (A-FBK)

| Action ID | Role | Module | Action Name | Preconditions | Primary Expected Outcome | Key Validations | Priority | Risk |
|-----------|------|--------|-------------|---------------|-------------------------|-----------------|----------|------|
| A-FBK-001 | Admin | Admin/Feedback | View All Feedback | Admin role | Feedback list shown | All feedback entries | P1 | Low |
| A-FBK-002 | Admin | Admin/Feedback | Add Admin Notes | Admin role, feedback exists | Notes saved | admin_notes updated | P2 | Low |
| A-FBK-003 | Admin | Admin/Feedback | Update Feedback Status | Admin role, feedback exists | Status changed | status field updated | P2 | Low |

---

## C) DETAILED E2E WORKFLOWS + TEST CASES

### [U-AUTH-001] — Sign Up with Email

- **Role:** Anonymous
- **Module:** Auth
- **Goal:** Create a new user account with email/password authentication
- **Preconditions:** 
  - User not already registered with this email
  - Email format is valid
- **Test Data Setup:**
  - Generate unique test email: `test-{timestamp}@example.com`
  - Password: `TestPass123!`
  - Full Name: `Test User`
  - University: `Test University`
  - Department: `Test Department`
- **Steps:**
  1. Navigate to `/auth`
  2. Click "Sign Up" toggle link
  3. Fill in "Full Name" field with test name
  4. Fill in "Email" field with test email
  5. Fill in "Department" field with test department
  6. Fill in "University" field with test university
  7. Fill in "Password" field with test password
  8. Fill in "Confirm Password" field with same password
  9. Click "Sign Up" button
- **Expected Output (UI):**
  - Loading state shown during submission
  - Toast notification: "Check your email" / success message
  - Form remains on auth page (awaiting email verification)
- **Expected Output (System/Backend):**
  - `auth.users` entry created with email, pending confirmation
  - `profiles` entry created via trigger with user_id, email, full_name, department, university
  - Verification email sent via Supabase Auth
- **Success Criteria:**
  - Toast shows success message
  - User can verify email and log in
  - Profile record exists with correct data
- **Failure Criteria:**
  - Error toast displayed
  - No user record created
  - Email not sent
- **Negative Tests:**
  1. Submit with existing email → "User already registered" error
  2. Submit with passwords that don't match → Validation error
  3. Submit with password < 6 chars → Validation error
  4. Submit with invalid email format → Validation error
  5. Submit with missing required fields → Validation error
- **Edge Cases:**
  1. Email with special characters (e.g., `test+tag@example.com`)
  2. Very long names (100 chars)
  3. Arabic/Unicode characters in name fields
  4. Simultaneous sign-up attempts with same email
- **Permission/Access Control Checks:**
  - Route accessible without authentication
  - No session token required
- **Audit/Logs/Telemetry Expectations:**
  - Sentry: No errors logged
  - Supabase Auth logs: Sign-up attempt recorded
- **Cleanup/Teardown:**
  - Delete test user from `auth.users` (cascades to profiles)
- **Notes/Dependencies:**
  - Requires email service (Supabase SMTP or external)
  - Email verification required before full access

---

### [U-AUTH-002] — Sign In with Email

- **Role:** Anonymous
- **Module:** Auth
- **Goal:** Authenticate existing user with email/password
- **Preconditions:**
  - User account exists and is verified
  - User knows correct password
- **Test Data Setup:**
  - Pre-created verified test user
  - Email: `verified-user@test.com`
  - Password: `TestPass123!`
- **Steps:**
  1. Navigate to `/auth`
  2. Ensure "Sign In" mode is active (default)
  3. Fill in "Email" field with test email
  4. Fill in "Password" field with test password
  5. Click "Sign In" button
- **Expected Output (UI):**
  - Loading state shown during submission
  - Redirect to `/app/dashboard`
  - Navigation shows user logged in state
  - Dashboard displays greeting with user's name
- **Expected Output (System/Backend):**
  - Session token created
  - `supabase.auth.getSession()` returns valid session
  - No errors logged
- **Success Criteria:**
  - User lands on dashboard
  - Session is active
  - User can access protected routes
- **Failure Criteria:**
  - Error toast displayed
  - Remains on auth page
  - No session created
- **Negative Tests:**
  1. Submit with wrong password → "Invalid login credentials" error
  2. Submit with non-existent email → "Invalid login credentials" error
  3. Submit with unverified email → Appropriate error message
  4. Submit with disabled account (is_disabled=true) → ASSUMPTION: Access blocked
- **Edge Cases:**
  1. Sign in immediately after sign up (email not verified yet)
  2. Sign in after password reset
  3. Multiple concurrent sign-in attempts
  4. Sign in with email case variations (Test@Email.com vs test@email.com)
- **Permission/Access Control Checks:**
  - Route accessible without authentication
  - After sign-in, auth routes should redirect to dashboard
- **Audit/Logs/Telemetry Expectations:**
  - Supabase Auth logs: Sign-in event recorded
  - Session start tracked
- **Cleanup/Teardown:**
  - Sign out after test
- **Notes/Dependencies:**
  - Depends on pre-existing verified user account

---

### [U-AUTH-003] — Sign Up/In with Google OAuth

- **Role:** Anonymous
- **Module:** Auth
- **Goal:** Authenticate via Google OAuth provider
- **Preconditions:**
  - Google OAuth configured in Supabase
  - User has Google account
- **Test Data Setup:**
  - Test Google account credentials (for manual testing)
  - Mock OAuth response (for automated testing)
- **Steps:**
  1. Navigate to `/auth`
  2. Click "Continue with Google" button
  3. (Google OAuth flow - external)
  4. Complete Google sign-in
  5. Return to `/complete-profile` (for new users)
  6. Fill required profile fields (if new user)
  7. Submit profile completion form
- **Expected Output (UI):**
  - Redirect to Google OAuth consent screen
  - Return to app after authorization
  - New users see profile completion form
  - Existing users redirect to dashboard
- **Expected Output (System/Backend):**
  - `auth.users` entry created (new user) or found (existing)
  - Session established
  - Profile created/updated via trigger
- **Success Criteria:**
  - User successfully authenticated
  - Profile data captured from Google where available
  - Dashboard accessible
- **Failure Criteria:**
  - OAuth flow fails
  - Error toast displayed
  - User stuck on profile completion
- **Negative Tests:**
  1. User denies Google permission → Error handling
  2. OAuth callback with invalid state → Security error
  3. Google account without email → Handle gracefully
- **Edge Cases:**
  1. User previously signed up with email, now tries Google with same email
  2. Multiple Google accounts
  3. OAuth token expiry during flow
- **Permission/Access Control Checks:**
  - OAuth redirect URLs properly configured
  - PKCE flow for security
- **Audit/Logs/Telemetry Expectations:**
  - OAuth provider sign-in logged
  - Profile completion tracked
- **Cleanup/Teardown:**
  - Sign out, optionally delete test Google-linked account
- **Notes/Dependencies:**
  - Requires Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  - Automated testing may require OAuth mocking

---

### [U-AUTH-004] — Sign Out

- **Role:** User
- **Module:** Auth
- **Goal:** End user session and clear authentication state
- **Preconditions:**
  - User is logged in
- **Test Data Setup:**
  - Logged-in test user session
- **Steps:**
  1. Navigate to `/app/settings`
  2. Scroll to "Danger Zone" section
  3. Click "Sign Out" button
- **Expected Output (UI):**
  - Redirect to landing page `/`
  - Navigation shows logged-out state
  - Protected routes no longer accessible
- **Expected Output (System/Backend):**
  - Session invalidated
  - `supabase.auth.getSession()` returns null
  - Local storage cleared of auth tokens
- **Success Criteria:**
  - User lands on landing page
  - Cannot access `/app/*` routes (redirects to auth)
- **Failure Criteria:**
  - Session persists
  - User remains logged in
- **Negative Tests:**
  1. Sign out with expired session → Should still clear local state
  2. Sign out during API call → Handle gracefully
- **Edge Cases:**
  1. Sign out on multiple devices simultaneously
  2. Sign out then navigate back
- **Permission/Access Control Checks:**
  - After sign-out, protected routes blocked
- **Audit/Logs/Telemetry Expectations:**
  - Sign-out event logged
- **Cleanup/Teardown:**
  - N/A
- **Notes/Dependencies:**
  - None

---

### [U-AUTH-005] — Request Password Reset

- **Role:** Anonymous
- **Module:** Auth
- **Goal:** Request password reset email for existing account
- **Preconditions:**
  - User account exists with this email
- **Test Data Setup:**
  - Known test user email
- **Steps:**
  1. Navigate to `/auth`
  2. Click "Forgot Password?" link
  3. Fill in "Email" field with test email
  4. Click "Send Reset Link" button
- **Expected Output (UI):**
  - Loading state during submission
  - Toast notification: "Reset link sent"
  - Form switches back to sign-in mode
- **Expected Output (System/Backend):**
  - Password reset email sent
  - Reset token generated
- **Success Criteria:**
  - User receives reset email
  - Email contains valid reset link
- **Failure Criteria:**
  - Error toast displayed
  - No email sent
- **Negative Tests:**
  1. Submit with non-existent email → Should still show success (security)
  2. Submit with invalid email format → Validation error
- **Edge Cases:**
  1. Multiple reset requests in short time
  2. Reset request for disabled account
- **Permission/Access Control Checks:**
  - No authentication required
- **Audit/Logs/Telemetry Expectations:**
  - Reset request logged
- **Cleanup/Teardown:**
  - N/A
- **Notes/Dependencies:**
  - Requires email service

---

### [U-AUTH-006] — Reset Password via Link

- **Role:** Anonymous
- **Module:** Auth
- **Goal:** Set new password using reset link from email
- **Preconditions:**
  - Valid password reset link received
  - Link not expired
- **Test Data Setup:**
  - Valid reset token/link
  - New password to set
- **Steps:**
  1. Click password reset link from email
  2. Navigate to `/auth` with recovery token in URL
  3. Page should show "Set New Password" mode
  4. Fill in "New Password" field
  5. Fill in "Confirm Password" field
  6. Click "Update Password" button
- **Expected Output (UI):**
  - Password fields displayed
  - Toast notification: "Password updated"
  - Redirect to dashboard
- **Expected Output (System/Backend):**
  - Password updated in auth.users
  - User can sign in with new password
- **Success Criteria:**
  - Password successfully changed
  - Can sign in with new password
- **Failure Criteria:**
  - Error during update
  - Old password still works
- **Negative Tests:**
  1. Submit with mismatched passwords → Validation error
  2. Use expired reset link → Error message
  3. Use already-used reset link → Error message
  4. Submit with weak password → Validation error
- **Edge Cases:**
  1. Reset link clicked multiple times
  2. Browser navigates away during submission
- **Permission/Access Control Checks:**
  - Valid recovery token required
- **Audit/Logs/Telemetry Expectations:**
  - Password change logged
- **Cleanup/Teardown:**
  - N/A
- **Notes/Dependencies:**
  - Depends on [U-AUTH-005]

---

### [U-CRS-001] — Create Course

- **Role:** User
- **Module:** Course
- **Goal:** Create a new study course
- **Preconditions:**
  - User is logged in
  - User is within course quota (Free: 3, Pro: unlimited)
- **Test Data Setup:**
  - Logged-in test user
  - Course title: "Test Course {timestamp}"
  - Exam date: 30 days from now
  - Color: "#6366f1"
- **Steps:**
  1. Navigate to `/app/courses`
  2. Click "Add Course" / "Create Course" button
  3. Dialog/form opens
  4. Fill in "Course Title" field
  5. Select exam date using date picker
  6. Optionally select color
  7. Click "Create" / "Save" button
- **Expected Output (UI):**
  - Dialog closes
  - Toast notification: success message
  - New course appears in course list
  - Course card shows title, exam date, progress
- **Expected Output (System/Backend):**
  - `courses` entry created with user_id, title, exam_date, color, status='active'
  - created_at timestamp set
- **Success Criteria:**
  - Course visible in list
  - Course data correct in DB
  - Can navigate to course detail
- **Failure Criteria:**
  - Error toast displayed
  - Course not created
  - Dialog remains open with error
- **Negative Tests:**
  1. Submit without title → Validation error
  2. Submit with exam date in past → ASSUMPTION: Allowed but warning shown
  3. Create course when at quota limit (Free) → Quota error
  4. Submit with very long title (>255 chars) → Validation error
- **Edge Cases:**
  1. Create course with Arabic/Unicode title
  2. Create course with today as exam date
  3. Create course with exam date 1 year away
  4. Create multiple courses rapidly
- **Permission/Access Control Checks:**
  - Only logged-in users can create
  - Course created with current user_id
- **Audit/Logs/Telemetry Expectations:**
  - Course creation logged
- **Cleanup/Teardown:**
  - Delete test course
- **Notes/Dependencies:**
  - Quota checked via check-quota edge function or client-side

---

### [U-CRS-005] — Delete Course

- **Role:** User
- **Module:** Course
- **Goal:** Delete a course and all associated data
- **Preconditions:**
  - User owns the course
  - Course exists
- **Test Data Setup:**
  - Course with topics created for test user
- **Steps:**
  1. Navigate to `/app/courses/{courseId}`
  2. Click menu (three dots) button
  3. Click "Delete Course" option
  4. Confirmation dialog appears showing topic count warning
  5. Confirm deletion
- **Expected Output (UI):**
  - Confirmation dialog with warning about cascade delete
  - After confirm: redirect to `/app/courses`
  - Toast notification: success message
  - Course no longer in list
- **Expected Output (System/Backend):**
  - `courses` entry deleted
  - `topics` entries cascade deleted
  - `course_files` entries cascade deleted
  - `study_plan_items` referencing course topics removed/updated
  - Files removed from storage
- **Success Criteria:**
  - Course gone from list
  - All related data deleted
  - No orphaned records
- **Failure Criteria:**
  - Error during deletion
  - Course persists
  - Orphaned data remains
- **Negative Tests:**
  1. Try to delete another user's course → 404 (RLS blocks)
  2. Delete course with active study plan items → Should cascade/handle
- **Edge Cases:**
  1. Delete course with many topics (100+)
  2. Delete course while file extraction in progress
  3. Delete course that was just created (no topics)
- **Permission/Access Control Checks:**
  - RLS ensures only owner can delete
- **Audit/Logs/Telemetry Expectations:**
  - Deletion logged
- **Cleanup/Teardown:**
  - N/A (course deleted by test)
- **Notes/Dependencies:**
  - None

---

### [U-TOP-001] — AI Extract Topics from File

- **Role:** User
- **Module:** Topic
- **Goal:** Use AI to extract study topics from uploaded file text
- **Preconditions:**
  - Course exists and owned by user
  - File uploaded and text extracted (extraction_status='extracted' or 'completed')
  - User within AI extraction quota
- **Test Data Setup:**
  - Course with uploaded syllabus file
  - File with extracted_text populated
- **Steps:**
  1. Navigate to `/app/courses/{courseId}`
  2. Go to "Files" tab
  3. Find file with "Ready" status
  4. Click "Extract Topics" button on file row
- **Expected Output (UI):**
  - Loading spinner on button
  - Toast notification on completion with topic count
  - Topics tab shows new topics
  - Topics have AI-generated attributes (difficulty, importance, etc.)
- **Expected Output (System/Backend):**
  - `ai_jobs` entry created with status='completed' (or 'needs_review')
  - `topics` entries created with extraction_run_id
  - Topics have title, difficulty_weight, exam_importance, estimated_hours
  - Prerequisites extracted (DAG structure)
- **Success Criteria:**
  - Topics created and visible
  - AI job completed successfully
  - Topic count matches expected
- **Failure Criteria:**
  - AI job fails
  - No topics created
  - Error toast displayed
- **Negative Tests:**
  1. Extract when at AI quota limit → Quota error
  2. Extract from file with no text → Should fail gracefully
  3. Extract while another extraction in progress → Prevented (button disabled)
- **Edge Cases:**
  1. Very long syllabus text (>30k chars) - truncation applied
  2. Non-English syllabus (Arabic)
  3. Syllabus with complex prerequisites
  4. AI returns invalid JSON → Repair loop attempted
  5. AI detects prerequisite cycles → Should break cycles, set needs_review
- **Permission/Access Control Checks:**
  - User must own course and file
  - AI quota enforced
- **Audit/Logs/Telemetry Expectations:**
  - AI job logged with type='extract_topics'
  - Token usage logged
- **Cleanup/Teardown:**
  - Delete created topics
- **Notes/Dependencies:**
  - Depends on LOVABLE_API_KEY configuration
  - AI latency may cause test timeout - use appropriate wait

---

### [U-PLN-001] — Generate Study Plan

- **Role:** User
- **Module:** Plan
- **Goal:** Generate AI-optimized study plan from courses and topics
- **Preconditions:**
  - User has at least one active course with exam_date
  - Course has at least one topic
  - Sufficient time until exam (0.25h per topic minimum)
- **Test Data Setup:**
  - Course with 5+ topics
  - Exam date 14 days from now
  - User profile with daily_study_hours=4
- **Steps:**
  1. Navigate to `/app/plan`
  2. Empty state or existing plan shown
  3. Click "Create Plan" / "Recreate Plan" button
- **Expected Output (UI):**
  - Generating overlay with animation
  - Toast notification with plan summary (days, items)
  - Plan displayed with collapsible daily sections
  - Each day shows topics with course colors
  - Summary card shows metrics
- **Expected Output (System/Backend):**
  - `study_plan_days` entries created
  - `study_plan_items` entries created linking to topics
  - Plan respects prerequisites (topological sort)
  - Plan distributes load based on exam proximity
  - plan_version incremented
- **Success Criteria:**
  - Plan visible with correct structure
  - Topics scheduled before exam dates
  - Prerequisites respected
  - Daily hours within user preference
- **Failure Criteria:**
  - Generation fails
  - No plan created
  - Invalid schedule (post-exam topics)
- **Negative Tests:**
  1. Generate with no courses → Empty state message
  2. Generate with courses but no topics → Contextual guidance
  3. Generate with no exam dates → Should handle gracefully
  4. Generate with insufficient time → Warning shown
- **Edge Cases:**
  1. Multiple courses with different exam dates
  2. Course with exam tomorrow
  3. Very large number of topics (100+)
  4. Topics with circular prerequisites → AI should break cycles
- **Permission/Access Control Checks:**
  - Plan scoped to current user
- **Audit/Logs/Telemetry Expectations:**
  - Plan generation logged
- **Cleanup/Teardown:**
  - Delete generated plan
- **Notes/Dependencies:**
  - Uses generate-unified-plan edge function

---

### [A-USR-003] — Grant Pro Access

- **Role:** Admin
- **Module:** Admin/Users
- **Goal:** Give a user Pro-level access via admin override
- **Preconditions:**
  - Current user is admin
  - Target user exists
- **Test Data Setup:**
  - Admin user logged in
  - Free-tier target user
- **Steps:**
  1. Navigate to `/admin/users`
  2. Search for target user by email
  3. Click "Manage" dropdown on user row
  4. Click "Grant Pro Access" option
- **Expected Output (UI):**
  - Toast notification: "Pro access granted"
  - User row updates to show "Pro (Override)" badge
- **Expected Output (System/Backend):**
  - `admin_overrides` entry created/updated for user
  - quota_overrides set to unlimited values (-1)
  - created_by set to admin's user_id
- **Success Criteria:**
  - User shows as Pro in admin panel
  - User's subscription hook returns isPro=true
  - User can create unlimited courses/topics
- **Failure Criteria:**
  - Error during update
  - Override not applied
- **Negative Tests:**
  1. Non-admin tries to access endpoint → 403/redirect
  2. Grant to non-existent user → Error handling
- **Edge Cases:**
  1. Grant Pro to user already on paid Pro subscription
  2. Grant Pro to user with existing trial override
  3. Grant Pro to admin user
- **Permission/Access Control Checks:**
  - Only admins can access /admin routes
  - RLS policies on admin_overrides
- **Audit/Logs/Telemetry Expectations:**
  - Admin action logged with created_by
- **Cleanup/Teardown:**
  - Reset user overrides
- **Notes/Dependencies:**
  - None

---

### [A-USR-007] — Promote to Admin

- **Role:** Admin
- **Module:** Admin/Users
- **Goal:** Grant admin privileges to a regular user
- **Preconditions:**
  - Current user is admin
  - Target user is not already admin
- **Test Data Setup:**
  - Admin user logged in
  - Regular user to promote
- **Steps:**
  1. Navigate to `/admin/users`
  2. Find target user
  3. Click "Manage" dropdown
  4. Click "Make Admin" option
- **Expected Output (UI):**
  - Toast notification: "User promoted to admin"
  - User row shows "Admin" badge
- **Expected Output (System/Backend):**
  - `user_roles` entry created with role='admin'
- **Success Criteria:**
  - User can now access /admin routes
  - User shows as admin in list
- **Failure Criteria:**
  - Role not created
  - User cannot access admin
- **Negative Tests:**
  1. Non-admin attempts promotion → Blocked by RLS
  2. Promote already-admin user → Handle gracefully
- **Edge Cases:**
  1. Promote user who then promotes others
  2. Self-promotion (should be impossible - already admin)
- **Permission/Access Control Checks:**
  - RLS on user_roles allows only admin writes
- **Audit/Logs/Telemetry Expectations:**
  - Role change logged
- **Cleanup/Teardown:**
  - Demote test user
- **Notes/Dependencies:**
  - Security-critical action

---

### [A-USR-009] — Disable User Account

- **Role:** Admin
- **Module:** Admin/Users
- **Goal:** Block a user from accessing the application
- **Preconditions:**
  - Current user is admin
  - Target user account is active (is_disabled=false)
- **Test Data Setup:**
  - Admin user logged in
  - Active target user
- **Steps:**
  1. Navigate to `/admin/users`
  2. Find target user
  3. Click "Manage" dropdown
  4. Click "Disable Account" option
- **Expected Output (UI):**
  - Toast notification: "User disabled"
  - User row shows "Disabled" badge in red
- **Expected Output (System/Backend):**
  - `profiles.is_disabled` set to true
- **Success Criteria:**
  - User shows as disabled
  - User cannot log in (ASSUMPTION: app checks is_disabled)
- **Failure Criteria:**
  - Update fails
  - User can still access app
- **Negative Tests:**
  1. Disable already-disabled user → Handle gracefully
  2. Admin disables themselves → Should be prevented
- **Edge Cases:**
  1. Disable user with active session (should they be kicked out?)
  2. Disable user with subscription
- **Permission/Access Control Checks:**
  - Only admins can modify profiles.is_disabled
- **Audit/Logs/Telemetry Expectations:**
  - Disable action logged
- **Cleanup/Teardown:**
  - Re-enable user
- **Notes/Dependencies:**
  - **OPEN ITEM**: Verify app actually checks is_disabled flag on login/session

---

### [A-PRM-002] — Create Promo Code

- **Role:** Admin
- **Module:** Admin/Promos
- **Goal:** Create a new promotional code for trial extensions
- **Preconditions:**
  - Current user is admin
- **Test Data Setup:**
  - Admin user logged in
- **Steps:**
  1. Navigate to `/admin/promos`
  2. Click "Create Promo Code" button
  3. Dialog opens
  4. Generate or enter promo code (e.g., "PRO-TEST01")
  5. Enter description (optional)
  6. Set trial days (e.g., 14)
  7. Set max redemptions (e.g., 100)
  8. Optionally set expiration date
  9. Click "Create Promo Code" button
- **Expected Output (UI):**
  - Dialog closes
  - Toast notification: "Promo code created"
  - New code appears in table
- **Expected Output (System/Backend):**
  - `promo_codes` entry created
  - created_by set to admin's user_id
  - current_redemptions=0
- **Success Criteria:**
  - Code visible in list
  - Code is redeemable by users
- **Failure Criteria:**
  - Creation fails
  - Code not in list
- **Negative Tests:**
  1. Create duplicate code → Error (unique constraint)
  2. Create with empty code → Validation error
  3. Create with trial_days=0 → Validation error
- **Edge Cases:**
  1. Create code with expiration in past → Should be prevented
  2. Create code with max_redemptions=1
  3. Create code with very long description
- **Permission/Access Control Checks:**
  - Only admins can create promo codes
- **Audit/Logs/Telemetry Expectations:**
  - Code creation logged with created_by
- **Cleanup/Teardown:**
  - Delete test promo code
- **Notes/Dependencies:**
  - None

---


---

## D) END-TO-END CRITICAL USER JOURNEYS (P0)

### Journey 1: New User Onboarding to First Study Plan

| **Journey ID** | J-001 |
|----------------|-------|
| **Goal** | Complete user journey from signup to having a working study plan |
| **Preconditions** | None (fresh user) |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Navigate to landing page | Landing page loads | URL is `/`, hero section visible |
| 2 | Click "Get Started" / Sign Up | Auth page opens | URL is `/auth`, sign-up form visible |
| 3 | Complete sign-up form | Account created | Toast shows success, verification email sent |
| 4 | Verify email (click link) | Account verified | Can sign in |
| 5 | Sign in with credentials | Redirect to dashboard | URL is `/app/dashboard`, greeting shown |
| 6 | Dashboard shows empty state | Onboarding guidance visible | "Create your first course" CTA shown |
| 7 | Click to create course | Course dialog opens | Form fields visible |
| 8 | Fill course details + exam date | Course created | Toast success, course in list |
| 9 | Navigate to course detail | Course page loads | Title, exam countdown visible |
| 10 | Upload syllabus file (PDF/image) | File uploaded | File in list, extraction starts |
| 11 | Wait for extraction to complete | File shows "Ready" status | "Extract Topics" button enabled |
| 12 | Click "Extract Topics" | AI extraction runs | Loading state, then topics appear |
| 13 | Review extracted topics | Topics displayed | Topic list with difficulty/importance |
| 14 | Navigate to Plan page | Plan page loads | Empty state or "Create Plan" CTA |
| 15 | Click "Create Plan" | Plan generated | Daily schedule displayed |
| 16 | Mark first item complete | Item checked off | Progress updates |

**Failure Handling:**
- If signup fails: Retry with different email, check email service
- If file extraction fails: Retry extraction, check file format
- If AI extraction fails: Check quota, retry, or add topics manually
- If plan generation fails: Check topics exist, retry

**Data Cleanup Plan:**
- Delete test user account (cascades all data)
- Verify storage files removed

---

### Journey 2: Free User Quota Limit Experience

| **Journey ID** | J-002 |
|----------------|-------|
| **Goal** | Verify quota limits are enforced and upgrade prompts shown |
| **Preconditions** | Free-tier test user exists |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as free user | Dashboard loads | User is free tier |
| 2 | Create courses up to limit (3) | 3 courses created | All 3 visible |
| 3 | Attempt to create 4th course | Quota error shown | Upgrade prompt/contact dialog |
| 4 | Navigate to existing course | Course loads | - |
| 5 | Add topics up to limit (50) | Topics created | Topic count at 50 |
| 6 | Attempt to add 51st topic | Quota error | Cannot add more |
| 7 | Use AI extraction 3 times | 3 extractions complete | Quota decremented |
| 8 | Attempt 4th AI extraction | Quota error | "Limit reached" message |
| 9 | Navigate to Settings | Subscription tab loads | Current plan shows "Free" |
| 10 | View pricing/upgrade options | Upgrade UI shown | Pro features listed |

**Failure Handling:**
- If quota not enforced: Bug - quota check not working
- If no upgrade prompt: UX issue - should guide to upgrade

**Data Cleanup Plan:**
- Delete all test courses and topics
- Reset AI usage counter for user

---

### Journey 3: Admin User Management Flow

| **Journey ID** | J-003 |
|----------------|-------|
| **Goal** | Admin grants Pro access, extends trial, and manages user |
| **Preconditions** | Admin account + free-tier target user |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as admin | Dashboard loads | Admin nav link visible |
| 2 | Navigate to /admin | Admin dashboard loads | Stats displayed |
| 3 | Navigate to /admin/users | User list displayed | All users visible |
| 4 | Search for target user | User found | User row shown |
| 5 | Click Manage → Grant Pro | Pro granted | Toast success, badge updates |
| 6 | Verify: Sign in as target user | Dashboard loads | Check subscription: isPro=true |
| 7 | Sign back in as admin | Admin panel | - |
| 8 | Reset user to Free | Override removed | Badge shows Free/N/A |
| 9 | Grant 30-day trial extension | Trial extended | Badge shows trial days |
| 10 | Disable user account | User disabled | "Disabled" badge shown |
| 11 | Try signing in as disabled user | Sign-in blocked | ASSUMPTION: Error message |
| 12 | Re-enable user account | User enabled | Badge removed |
| 13 | Sign in as re-enabled user | Sign-in succeeds | Dashboard loads |

**Failure Handling:**
- If admin panel not accessible: Check user_roles entry
- If override not applied: Check admin_overrides table

**Data Cleanup Plan:**
- Reset all overrides on target user
- Ensure target user is enabled

---

### Journey 4: Promo Code Creation and Redemption

| **Journey ID** | J-004 |
|----------------|-------|
| **Goal** | Admin creates promo code, user redeems it |
| **Preconditions** | Admin account + free-tier target user |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as admin | Admin accessible | - |
| 2 | Navigate to /admin/promos | Promo list loads | - |
| 3 | Click "Create Promo Code" | Dialog opens | - |
| 4 | Generate code "TEST-PROMO-001" | Code generated | Code in input |
| 5 | Set 14 trial days, 10 max redemptions | Fields filled | - |
| 6 | Click Create | Code created | Code in list, current_redemptions=0 |
| 7 | Copy code to clipboard | Code copied | Toast confirmation |
| 8 | Sign out as admin | Signed out | - |
| 9 | Sign in as free user | Dashboard loads | - |
| 10 | Navigate to Settings → Subscription | Subscription tab loads | "Free" plan shown |
| 11 | Find promo code input | Input visible | Promo code redemption section |
| 12 | Enter "TEST-PROMO-001" | Code entered | - |
| 13 | Click Redeem | Code redeemed | Toast success, trial extended |
| 14 | Verify subscription status | Trial active | Shows trial days, Pro features |
| 15 | Sign in as admin, check code | Code updated | current_redemptions=1 |

**Failure Handling:**
- If code redemption fails: Check code is_active, not expired, not at max
- If trial not applied: Check promo_redemptions entry

**Data Cleanup Plan:**
- Delete test promo code
- Delete promo_redemptions entry
- Reset user trial status

---

### Journey 5: Google Calendar Integration

| **Journey ID** | J-005 |
|----------------|-------|
| **Goal** | User connects Google Calendar and syncs study plan |
| **Preconditions** | User with study plan, Google account |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as user | Dashboard loads | Study plan exists |
| 2 | Navigate to Settings → Calendar | Calendar tab loads | Connect button visible |
| 3 | Click "Connect Google Calendar" | OAuth flow starts | Redirect to Google |
| 4 | Complete Google authorization | Return to app | Connection established |
| 5 | Verify connection status | "Connected" shown | Calendar ID displayed |
| 6 | Navigate to Dashboard | Dashboard loads | Sync button visible |
| 7 | Click "Sync to Calendar" | Sync runs | Toast with event count |
| 8 | Verify events in Google Calendar | Events created | Study sessions as events |
| 9 | Return to Settings → Calendar | Connection shown | Disconnect option available |
| 10 | Click Disconnect | Connection removed | Connect button reappears |
| 11 | Verify tokens cleared | No connection | google_calendar_connections.is_active=false |

**Failure Handling:**
- If OAuth fails: Check Google credentials configuration
- If sync fails: Check token validity, calendar permissions

**Data Cleanup Plan:**
- Disconnect calendar
- Delete created calendar events (if possible via API)

---

### Journey 6: Complete Course Study Lifecycle

| **Journey ID** | J-006 |
|----------------|-------|
| **Goal** | Full lifecycle: create course → study → complete → exam |
| **Preconditions** | User account |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Create course with exam 7 days away | Course created | Exam countdown shows 7 days |
| 2 | Manually add 10 topics | Topics created | Topic list shows 10 |
| 3 | Generate study plan | Plan created | 7 days of study items |
| 4 | Day 1: Complete all items | Items checked | Progress updates |
| 5 | Use Pomodoro timer for session | Timer runs | Session tracked |
| 6 | Complete Pomodoro session | Session recorded | pomodoro_sessions entry |
| 7 | Day 2-6: Mark items complete | Progress increases | - |
| 8 | Day 7: All items complete | 100% completion | All items checked |
| 9 | View course progress | 100% shown | All topics marked done |
| 10 | Exam day arrives | Exam countdown at 0 | "Today!" or similar message |
| 11 | Delete course (post-exam) | Course deleted | No longer in list |

**Failure Handling:**
- If plan generation fails: Check exam date is future
- If progress doesn't update: Check DB constraints

**Data Cleanup Plan:**
- Delete test course (if not already deleted in step 11)

---

### Journey 7: Multi-Course Study Plan

| **Journey ID** | J-007 |
|----------------|-------|
| **Goal** | Manage multiple courses with different exam dates |
| **Preconditions** | Pro user (or user with no quota limits) |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Create Course A: Exam in 10 days | Course created | - |
| 2 | Add 5 topics to Course A | Topics created | - |
| 3 | Create Course B: Exam in 20 days | Course created | - |
| 4 | Add 8 topics to Course B | Topics created | - |
| 5 | Create Course C: Exam in 5 days | Course created | - |
| 6 | Add 3 topics to Course C | Topics created | - |
| 7 | Generate study plan | Plan created | Covers all 16 topics |
| 8 | Verify priority ordering | Course C prioritized | Earliest exam gets more focus early |
| 9 | Check Course A distribution | Balanced allocation | Topics spread across days |
| 10 | Check Course B distribution | Later allocation | Topics scheduled after A's exam |
| 11 | Complete Course C items | Items done | Course C at 100% |
| 12 | Recreate plan after Course C exam | Plan updated | Only A and B topics |

**Failure Handling:**
- If plan doesn't prioritize correctly: Check algorithm
- If topics missing from plan: Check prerequisites

**Data Cleanup Plan:**
- Delete all test courses

---

### Journey 8: Account Deletion Flow

| **Journey ID** | J-008 |
|----------------|-------|
| **Goal** | User deletes account and all data is removed |
| **Preconditions** | User with courses, topics, files, plan |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as user with data | Dashboard loads | Data visible |
| 2 | Note user_id for verification | User ID recorded | - |
| 3 | Navigate to Settings | Settings page loads | - |
| 4 | Scroll to Danger Zone | Delete section visible | - |
| 5 | Click "Export Data" first | JSON downloaded | Contains all user data |
| 6 | Click "Delete Account" | Confirmation dialog | Warning shown |
| 7 | Enter password | Password entered | - |
| 8 | Confirm deletion | Account deleted | Signed out, redirect to landing |
| 9 | Try signing in again | Sign-in fails | Account not found |
| 10 | DB verification | Data removed | No records with user_id |

**Failure Handling:**
- If deletion fails: Check password verification
- If data remains: Check cascade delete triggers

**Data Cleanup Plan:**
- N/A (account already deleted)

---

### Journey 9: Password Reset Flow

| **Journey ID** | J-009 |
|----------------|-------|
| **Goal** | User recovers access via password reset |
| **Preconditions** | User account with known email |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Navigate to /auth | Auth page loads | - |
| 2 | Click "Forgot Password?" | Reset mode shown | Email field visible |
| 3 | Enter user email | Email entered | - |
| 4 | Click "Send Reset Link" | Link sent | Toast confirmation |
| 5 | Check email inbox | Reset email received | Contains reset link |
| 6 | Click reset link | Auth page with recovery | "Set New Password" shown |
| 7 | Enter new password twice | Passwords entered | - |
| 8 | Click "Update Password" | Password updated | Toast success, redirect |
| 9 | Sign out | Signed out | - |
| 10 | Sign in with new password | Sign-in succeeds | Dashboard loads |

**Failure Handling:**
- If email not received: Check spam, email service
- If reset fails: Check token validity

**Data Cleanup Plan:**
- N/A (or reset password back)

---

### Journey 10: Admin Dashboard Monitoring

| **Journey ID** | J-010 |
|----------------|-------|
| **Goal** | Admin monitors system health and user activity |
| **Preconditions** | Admin account, some user activity in system |

**Steps:**

| Step | Action | Expected Result | Assertion |
|------|--------|-----------------|-----------|
| 1 | Sign in as admin | Dashboard loads | - |
| 2 | Navigate to /admin | Admin dashboard loads | Stats cards visible |
| 3 | Verify user count | Count displayed | Matches expected |
| 4 | Verify course count | Count displayed | Matches expected |
| 5 | View weekly comparison | Charts displayed | User/AI job trends |
| 6 | Check AI usage chart | Pie chart shown | Job types breakdown |
| 7 | Check system health | Health panel shown | DB, AI, Storage status |
| 8 | Click refresh health | Health refreshed | Latest status shown |
| 9 | View top active users | Table displayed | Users with activity |
| 10 | Navigate to /admin/feedback | Feedback list | User submissions shown |

**Failure Handling:**
- If stats not loading: Check admin-stats edge function
- If health check fails: Check admin-health-check function

**Data Cleanup Plan:**
- N/A

---

## E) ADMIN GOVERNANCE & SAFETY TESTS

### E.1 Admin Audit Log Coverage

| Test ID | Description | Expected Behavior | Priority |
|---------|-------------|-------------------|----------|
| E-AUD-001 | Pro access grants are logged | admin_overrides.created_by populated | P0 |
| E-AUD-002 | Trial extensions are logged | admin_overrides.notes contains action | P1 |
| E-AUD-003 | Promo code creation logged | promo_codes.created_by populated | P1 |
| E-AUD-004 | User role changes tracked | user_roles.created_at timestamp | P0 |

**⚠️ CRITICAL OPEN ITEM (P0):** No dedicated audit_log table exists. Audit is implicit via created_by/created_at fields. **MUST** add explicit audit logging before production for compliance. This affects tests E-AUD-001 through E-AUD-004.

### E.2 Role Changes and Permission Escalation Prevention

| Test ID | Description | Expected Behavior | Priority |
|---------|-------------|-------------------|----------|
| E-ROL-001 | Non-admin cannot access /admin | Redirect to /app or 403 | P0 |
| E-ROL-002 | Non-admin cannot create admin_overrides | RLS blocks insert | P0 |
| E-ROL-003 | Non-admin cannot modify user_roles | RLS blocks insert/delete | P0 |
| E-ROL-004 | Admin cannot demote themselves (last admin) | ASSUMPTION: Should be prevented | P1 |
| E-ROL-005 | Newly promoted admin has immediate access | No re-login required | P1 |
| E-ROL-006 | Demoted admin loses access immediately | Next route check blocks | P1 |

### E.3 Data Export/Import Actions

| Test ID | Description | Expected Behavior | Priority |
|---------|-------------|-------------------|----------|
| E-EXP-001 | User can export own data | JSON contains all user data | P0 |
| E-EXP-002 | Export includes courses, topics, files metadata | Verify JSON structure | P1 |
| E-EXP-003 | Export does NOT include other users' data | RLS scoping verified | P0 |
| E-EXP-004 | Admin cannot bulk export all users | No such endpoint exists | P1 |

### E.4 Account Deactivation/Ban/Unban Flows

| Test ID | Description | Expected Behavior | Priority |
|---------|-------------|-------------------|----------|
| E-BAN-001 | Admin can disable user account | is_disabled=true set | P0 |
| E-BAN-002 | Disabled user cannot sign in | Auth blocked | P0 |
| E-BAN-003 | Disabled user's active session invalidated | ASSUMPTION: Should be blocked | P1 |
| E-BAN-004 | Admin can re-enable account | is_disabled=false set | P0 |
| E-BAN-005 | Re-enabled user can sign in | Auth succeeds | P0 |

**⚠️ CRITICAL SECURITY ITEM (P0):** Verify that is_disabled check happens on every authenticated request, not just sign-in. If disabled users can continue using active sessions, this creates a significant security vulnerability. **MUST** be resolved before production.

### E.5 Security-Sensitive Changes

| Test ID | Description | Expected Behavior | Priority |
|---------|-------------|-------------------|----------|
| E-SEC-001 | Password update requires current session | Cannot update via API without auth | P0 |
| E-SEC-002 | Account deletion requires password confirmation | Must re-authenticate | P0 |
| E-SEC-003 | OAuth tokens are encrypted in DB | encrypted_* columns used | P1 |
| E-SEC-004 | API keys not exposed to client | LOVABLE_API_KEY server-side only | P0 |
| E-SEC-005 | Stripe webhooks verified via signature | STRIPE_WEBHOOK_SECRET validation | P0 |
| E-SEC-006 | Rate limiting on AI endpoints | 429 returned when exceeded | P0 |

---

## F) NON-FUNCTIONAL E2E CHECKLIST

### F.1 Performance Smoke Tests

| Check | Target | Method | Priority |
|-------|--------|--------|----------|
| Landing page load | < 3s | Lighthouse/WebVitals | P0 |
| Dashboard load (authenticated) | < 2s | Measure time-to-interactive | P0 |
| Course list load | < 1s | API response time | P0 |
| AI topic extraction | < 60s | Edge function timeout | P0 |
| Plan generation | < 30s | Edge function timeout | P0 |
| File upload (10MB) | < 30s | Upload complete | P1 |

### F.2 Reliability Tests

| Check | Expected Behavior | Priority |
|-------|-------------------|----------|
| AI extraction retry on 5xx | Up to 3 retries with backoff | P0 |
| Idempotent plan generation | Same input = same output | P1 |
| Webhook duplicate handling | webhook_events tracks processed | P0 |
| Session persistence | Survives page refresh | P0 |
| Offline graceful degradation | Error messages, no crashes | P2 |

### F.3 Accessibility Smoke Checks

| Check | Standard | Tool | Priority |
|-------|----------|------|----------|
| Color contrast ratio | WCAG 2.1 AA (4.5:1) | axe-core | P1 |
| Keyboard navigation | All interactive elements | Manual | P1 |
| Screen reader labels | aria-labels present | axe-core | P1 |
| Focus indicators | Visible focus rings | Manual | P1 |
| RTL layout (Arabic) | Proper mirroring | Visual inspection | P0 |

### F.4 Localization/Timezone Handling

| Check | Expected Behavior | Priority |
|-------|-------------------|----------|
| Arabic language toggle | UI switches to Arabic | P0 |
| RTL text direction | dir="rtl" applied | P0 |
| Date formatting (AR locale) | Arabic date format | P1 |
| Istanbul timezone for dates | DATE type, UTC+3 handling | P0 |
| Exam date calculations | Correct day boundaries | P0 |

### F.5 Browser/Device Matrix

| Browser | Version | Platform | Priority |
|---------|---------|----------|----------|
| Chrome | Latest | Desktop | P0 |
| Firefox | Latest | Desktop | P1 |
| Safari | Latest | Desktop/iOS | P1 |
| Edge | Latest | Desktop | P2 |
| Chrome | Latest | Android | P1 |
| Safari | Latest | iOS | P1 |

### F.6 Monitoring and Alerting Readiness

| Check | Status | Priority |
|-------|--------|----------|
| Sentry error tracking connected | ✅ Configured in main.tsx | P0 |
| Structured logging in edge functions | ✅ logger.ts shared | P1 |
| Admin health check endpoint | ✅ admin-health-check | P1 |
| Uptime monitoring | **⚠️ CRITICAL**: Not configured - MUST add before production | P0 |
| Alert thresholds defined | **⚠️ CRITICAL**: Not defined - MUST define before production | P0 |

---

## G) OPEN ITEMS / QUESTIONS

### G.1 Missing Information Required

| ID | Category | Question/Missing Item | Impact |
|----|----------|----------------------|--------|
| OI-001 | Auth | Does is_disabled check happen on every request or just sign-in? | Security |
| OI-002 | Auth | What happens to active sessions when user is disabled? | Security |
| OI-003 | Stripe | Stripe integration is referenced but webhook behavior under test mode unclear | Billing |
| OI-004 | Quotas | Exact quota values for Free vs Pro plans needed for test assertions | Test Data |
| OI-005 | AI | Expected AI response format and validation rules for test assertions | Test Accuracy |
| OI-006 | Calendar | Google Calendar event format and sync behavior details | Integration |
| OI-007 | Audit | No explicit audit_log table - is implicit logging sufficient for compliance? | Compliance |
| OI-008 | Admin | Can admin demote themselves if they are the last admin? | Safety |

### G.2 Assumptions Made

| ID | Assumption | Verification Status |
|----|------------|---------------------|
| AS-001 | Disabled users (is_disabled=true) cannot sign in | ⚠️ **NEEDS VERIFICATION** - Test E-BAN-002 |
| AS-002 | Email verification is required before full access | Test U-AUTH-001 |
| AS-003 | Course quota is 3 for Free, unlimited (-1) for Pro | ✅ **VERIFIED** in useSubscription.ts:28 |
| AS-004 | Topic quota is 50 for Free, unlimited for Pro | ✅ **VERIFIED** in useSubscription.ts:29 |
| AS-005 | AI extraction quota is 3/month for Free, 50 for Pro | ✅ **VERIFIED** in check-quota/index.ts and migrations |
| AS-006 | Promo code redemption extends trial_end date | Test J-004 |
| AS-007 | Plan generation uses topological sort for prerequisites | ✅ **VERIFIED** in PIPELINE_CONTRACT.md |
| AS-008 | OAuth tokens are encrypted before storage | ✅ **VERIFIED** - encrypted_* columns in schema |

### G.3 Recommended Pre-Launch Verifications

1. **Security Audit**: Verify RLS policies cover all edge cases
2. **Load Testing**: Test AI extraction under concurrent load
3. **Backup Verification**: Test database restore procedure
4. **Stripe Live Mode**: Test with real payment in sandbox
5. **Email Deliverability**: Verify emails not going to spam
6. **Mobile Responsiveness**: Full mobile testing on iOS/Android
7. **Accessibility Audit**: Full WCAG 2.1 compliance check
8. **Legal Review**: Terms/Privacy policy review by legal

---

## Appendix A: Test Data Requirements

### A.1 Required Test Users

| User Type | Email Pattern | Role | Subscription | Purpose |
|-----------|---------------|------|--------------|---------|
| Anonymous | N/A | None | None | Public page testing |
| Free User | free-user@test.com | user | Free | Quota limit testing |
| Pro User | pro-user@test.com | user | Pro | Full feature testing |
| Trial User | trial-user@test.com | user | Trial | Trial flow testing |
| Admin | admin@test.com | admin | Pro | Admin panel testing |
| Disabled | disabled@test.com | user | Free | Disable flow testing |

### A.2 Required Test Courses

| Course | Topics | Exam Date | Purpose |
|--------|--------|-----------|---------|
| Test Course A | 5 | +10 days | General testing |
| Test Course B | 10 | +20 days | Multi-course testing |
| Test Course C | 3 | +5 days | Priority testing |
| Large Course | 50 | +30 days | Quota/performance testing |

### A.3 Required Test Files

| File | Type | Size | Content | Purpose |
|------|------|------|---------|---------|
| syllabus.pdf | PDF | 500KB | Sample syllabus | File upload testing |
| syllabus.png | Image | 200KB | Syllabus screenshot | OCR testing |
| large.pdf | PDF | 10MB | Large document | Size limit testing |
| empty.pdf | PDF | 10KB | Empty document | Edge case testing |
| arabic.pdf | PDF | 300KB | Arabic content | Localization testing |

---

## Appendix B: Edge Function Inventory

| Function | Endpoint | Auth Required | Admin Only | Purpose |
|----------|----------|---------------|------------|---------|
| extract-topics | POST | Yes | No | AI topic extraction |
| generate-unified-plan | POST | Yes | No | Study plan generation |
| parse-pdf | POST | Yes | No | PDF text extraction |
| ocr-pages | POST | Yes | No | OCR for images |
| ingest-pdf-text | POST | Yes | No | Text ingestion |
| check-quota | POST | Yes | No | Quota verification |
| delete-account | POST | Yes | No | Account deletion |
| export-user-data | POST | Yes | No | GDPR export |
| google-calendar-auth | POST | Yes | No | OAuth flow |
| sync-calendar | POST | Yes | No | Calendar sync |
| disconnect-calendar | POST | Yes | No | Remove calendar |
| stripe-webhook | POST | No (signature) | No | Stripe events |
| admin-stats | POST | Yes | Yes | Admin metrics |
| admin-health-check | POST | Yes | Yes | System health |

---

## Appendix C: Database Constraints & Indexes

### Key Constraints

| Table | Constraint | Type |
|-------|------------|------|
| profiles | user_id UNIQUE | Unique |
| courses | user_id + id | RLS scoped |
| topics | course_id + topic_key + extraction_run_id | Unique (optional) |
| promo_codes | code UNIQUE | Unique |
| user_roles | user_id + role UNIQUE | Unique |
| admin_overrides | user_id UNIQUE | Unique |

### Performance Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| courses | user_id | User's courses lookup |
| topics | course_id | Course topics lookup |
| topics | user_id | User's all topics |
| ai_jobs | user_id, course_id | Job lookup |
| study_plan_days | user_id, date | Plan day lookup |
| study_plan_items | plan_day_id | Day items lookup |

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Author: QA Automation Team*  
*Status: Ready for Implementation*
