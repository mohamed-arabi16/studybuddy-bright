# StudyBuddy Pipeline Contract

This document defines the contracts, invariants, and requirements for the StudyBuddy AI pipeline.

---

## Core Invariants

These invariants MUST be enforced across all pipeline functions:

### 1. Ownership
- Every `courseId`, `fileId`, `topicId` MUST belong to the authenticated user
- Ownership is verified via `user_id` column matching `auth.uid()`
- Service role operations MUST include explicit ownership checks

### 2. Idempotency
- Same file/course should NOT create duplicate topics or plans
- Enforced via:
  - `extraction_run_id` tracking
  - Atomic locking on status fields
  - Unique constraints on `(course_id, user_id, extraction_run_id, topic_key)`

### 3. Deterministic Validation
- All LLM output is validated and either repaired or rejected
- Invalid prerequisites are detected (cycles) and broken
- Topic duplicates are detected and merged

### 4. Versioning & Provenance
- `extraction_run_id` tracks topic provenance
- `plan_version` tracks study plan iterations
- `topic_extraction_run_id` in plan items enables stale plan detection

---

## Function Contracts

### parse-pdf

**Purpose**: Extract text content from uploaded course files

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileId` | UUID | Yes | ID of the course_file to process |
| `Authorization` | Header | Yes | Bearer token for user auth |

**Preconditions**:
- File exists in `course_files` table
- File belongs to authenticated user (`user_id` match)
- File `extraction_status` in `['pending', 'failed', 'manual_required', 'empty']`
- File size ≤ 10MB

**Output**:
| Field | Type | Description |
|-------|------|-------------|
| `extraction_status` | string | 'extracted', 'failed', 'empty', 'file_too_large', 'manual_required' |
| `extracted_text` | string | Extracted content (max 100k chars) |
| `extraction_run_id` | UUID | Unique ID for this extraction attempt |
| `extraction_quality` | string | 'high', 'medium', 'low', 'failed' |
| `extraction_method` | string | 'ai_vision' |
| `extraction_metadata` | JSONB | Processing details |

**Idempotency Key**: `fileId` + `user_id`

**Side Effects**:
- Updates `course_files` record
- Does NOT trigger `extract-topics` (decoupled)

**Status Transitions**:
```
pending ──┬──> extracting ──┬──> extracted
failed ───┤                 ├──> failed
manual_required             ├──> empty
empty ────┘                 ├──> file_too_large
                            └──> manual_required
```

---

### extract-topics

**Purpose**: Extract study topics from text using AI

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `courseId` | UUID | Yes | Target course |
| `text` | string | Yes | Content to analyze |
| `fileId` | UUID | No | Source file (for provenance) |
| `mode` | string | No | 'replace' (default) or 'append' |
| `extractionRunId` | UUID | No | Explicit run ID (auto-generated if not provided) |
| `Authorization` | Header | Yes | Bearer token |

**Preconditions**:
- Course exists and belongs to user
- File (if provided) belongs to user and course
- User has remaining topic quota (free plan)

**Output**:
| Field | Type | Description |
|-------|------|-------------|
| `topics_count` | number | Topics successfully created |
| `job_id` | UUID | AI job record ID |
| `extraction_run_id` | UUID | Run ID for this extraction |
| `needs_review` | boolean | True if low confidence |
| `questions` | string[] | Clarifying questions for student |
| `cycles_detected` | boolean | True if prerequisite cycles were found and broken |

**Idempotency Key**: `courseId` + `mode` + `extractionRunId`

**Topics Created With**:
- `source_file_id`: Links to originating file
- `extraction_run_id`: Groups topics from same extraction
- `topic_key`: AI-generated key (t01, t02, etc.)

**Validations**:
- Title non-empty, max 200 chars
- difficulty_weight, exam_importance: 1-5
- confidence_level: 'high', 'medium', 'low'
- Prerequisites reference valid topic_keys
- Cycle detection with automatic breaking
- **Cycle Policy**: When cycles detected:
  - Set `needs_review = true`
  - Add warning to `questions_for_student`
  - Break cycles by removing weakest edges
  - Record broken cycles in job result

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Authorization` | Header | Yes | Bearer token |

**Preconditions**:
- At least one active course with exam_date
- At least one pending topic exists
- Sufficient time for minimum coverage (0.25h per topic)

**Output**:
| Field | Type | Description |
|-------|------|-------------|
| `plan_days` | number | Study days created |
| `plan_items` | number | Individual topic slots |
| `plan_version` | number | Incremented version |
| `topics_snapshot_id` | UUID | Hash of topic extraction run IDs |
| `warnings` | string[] | Scheduling warnings |
| `validation_passed` | boolean | True if AI output validated |
| `cycles_detected` | boolean | True if prerequisite cycles exist |

**Plan Days Created With**:
- `topics_snapshot_id`: Hash of all topic extraction run IDs for staleness detection

**Validations**:
- All topic_ids exist and belong to user
- All dates are available (not days off)
- All dates are before respective exam dates
- Prerequisites scheduled before dependents
- DAG validation (topological sort)
- Duplicate topic detection

**Repair Loop**:
If validation fails, the system:
1. Sends errors back to AI for correction
2. Re-validates corrected schedule
3. Falls back to original if repair fails

---

## Database Schema Additions

### course_files
| Column | Type | Description |
|--------|------|-------------|
| `extraction_run_id` | UUID | Unique ID per extraction attempt |
| `extraction_method` | TEXT | 'ai_vision', 'manual' |
| `extraction_quality` | TEXT | 'high', 'medium', 'low', 'failed' |
| `extraction_metadata` | JSONB | Processing details |

### topics
| Column | Type | Description |
|--------|------|-------------|
| `source_file_id` | UUID | FK to course_files |
| `extraction_run_id` | UUID | Groups topics from same run |
| `topic_key` | TEXT | AI-generated key (t01, etc.) |

### study_plan_days
| Column | Type | Description |
|--------|------|-------------|
| `topics_snapshot_id` | UUID | Hash of topic run IDs for staleness detection |

### study_plan_items
| Column | Type | Description |
|--------|------|-------------|
| `topic_extraction_run_id` | UUID | For per-item stale detection |

## Status Values

### course_files.extraction_status
| Status | Description |
|--------|-------------|
| `pending` | Awaiting processing |
| `extracting` | Currently processing (locked) |
| `extracted` | Successfully extracted |
| `failed` | Processing failed |
| `empty` | No content extracted |
| `file_too_large` | Exceeds size limit |
| `manual_required` | Needs manual text input |

### ai_jobs.status
| Status | Description |
|--------|-------------|
| `running` | Job in progress |
| `completed` | Successful completion |
| `needs_review` | Low confidence, needs user review |
| `failed` | Job failed |

---

## Error Handling

### Rate Limits
- Return 429 with retry guidance
- Update job status to 'failed'

### Validation Failures
- Log detailed errors
- Attempt repair loop (AI)
- Return warnings if repair fails

### Ownership Violations
- Return 404 (not 403) to prevent enumeration
- Log security event

---

## Date Handling Standard

**Timezone**: Istanbul (Europe/Istanbul, UTC+3 fixed - no DST since 2016)

**Rationale**: Students studying in Istanbul expect "today" to be Istanbul calendar day boundaries, not UTC.

**Implementation**:
```typescript
const ISTANBUL_OFFSET_HOURS = 3;

function getTodayIstanbul(): Date {
  const now = new Date();
  const istanbulMs = now.getTime() + (ISTANBUL_OFFSET_HOURS * 60 * 60 * 1000);
  const istanbulDate = new Date(istanbulMs);
  return new Date(Date.UTC(
    istanbulDate.getUTCFullYear(),
    istanbulDate.getUTCMonth(),
    istanbulDate.getUTCDate()
  ));
}
```

**Storage**: Dates stored as `DATE` type (date-only, no time component)

**Comparisons**: Use string comparison (YYYY-MM-DD format)

---

## Best Practices

### For Callers
1. Always pass `Authorization` header
2. Handle 202 (in progress) responses
3. Poll job status for long-running operations
4. Display warnings to users

### For Modifications
1. Always verify ownership before mutations
2. Use atomic updates for status changes
3. Track provenance (run IDs, file IDs)
4. Log structured metadata, not content

---

## PDF Handling (Interim)

**Current Policy**: PDFs are marked as `manual_required` and not processed via vision API.

**Reason**: Vision APIs (image_url) are not reliable for PDF document understanding.

**User Experience**: Users are prompted to paste syllabus text manually.

**Future**: Add proper PDF text extraction (e.g., pdf-parse or similar).
