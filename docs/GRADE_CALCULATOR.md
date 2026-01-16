# Grade Calculator Feature Documentation

## Overview

The Grade Calculator is a comprehensive tool that allows students to:
1. Calculate their term grade based on course grading profiles
2. Predict their overall grade based on expected final exam scores
3. Perform "what-if" analysis to determine what score they need on upcoming assessments

## Feature Location

- **URL Route**: `/app/grade-calculator`
- **Navigation**: Accessible from the main sidebar under the Calculator icon
- **Page Component**: `src/pages/GradeCalculator.tsx`

## Grading Profile Configuration

### Components and Weights

Each grading component supports:

| Property | Description | Example |
|----------|-------------|---------|
| **Name** | Component identifier | "Midterm", "Final", "Quizzes" |
| **Weight** | Percentage of overall grade (should sum to 100%) | 25%, 40%, 35% |
| **Scale Max** | Maximum possible score for items | 100, 20, 10 |
| **Group** | Classification for constraints | "exam" or "work" |
| **Aggregation Rule** | How multiple items combine | See below |

### Aggregation Rules

| Rule | Description |
|------|-------------|
| **Average** | Simple average of all normalized scores |
| **Sum** | Total raw points divided by total max points |
| **Drop Lowest** | Drop the N lowest scores before averaging |
| **Best Of** | Take only the N highest scores |
| **Weighted** | Individual items have different weights |

### Score Entry

For each component, students can add multiple items:
- **Item Name**: Identifier for the score (e.g., "Quiz 1", "HW 3")
- **Raw Score**: The actual score achieved (or leave blank if not yet graded)
- **Max Score**: Maximum possible score for this item
- **Weight** (optional): For weighted aggregation only

## Advanced Settings

### Passing Threshold
- Set the minimum overall score required to pass (default: 60%)
- Configurable via slider from 0-100%

### Rounding Method
- **None**: No rounding applied
- **Nearest**: Round to nearest integer
- **Floor**: Round down
- **Ceiling**: Round up

### Curve Adjustments

Support for various curve types:

| Target | Type | Description |
|--------|------|-------------|
| **Component** | Add | Add points to a specific component (e.g., +10 to Midterm) |
| **Component** | Multiply | Scale a component (e.g., ×1.1 for 10% boost) |
| **Component** | Set | Override to a specific value |
| **Overall** | Add | Add points to the final grade |
| **Overall** | Multiply | Scale the final grade |
| **Clamp** | Boolean | Prevent scores from exceeding 0-100 range |

### Constraints

| Constraint Type | Description |
|-----------------|-------------|
| **Min Exam Average** | Require minimum average across all exam components |
| **Cap Work Score** | Limit work score to N times the exam average |
| **Min Component** | Require minimum score on a specific component |

## Calculation Procedure

1. **Normalize** every item to 0-100 scale
2. **Aggregate** items per component using its rule
3. Apply **component-level curves**
4. Compute **weighted subtotal**: Σ(weight × component_score)
5. Check **constraints** and generate warnings
6. Apply **overall-level curves**
7. Apply **rounding**
8. Map to **letter grade** (using configurable boundaries)
9. Determine **pass/fail** status

## What-If Analysis

Students can:
1. Set a **target grade** they want to achieve
2. Select a **component** to solve for
3. The calculator computes the **required score** on that component

Formula: `required_score = (target - current_subtotal) / component_weight × 100`

## Results Display

The results panel shows:
- **Final Grade**: Numerical score with letter grade
- **Pass/Fail Status**: Based on passing threshold
- **Component Breakdown**: Score and contribution for each component
- **Warnings**: Any constraints violated or potential issues

## Default Grade Boundaries

| Letter | Min Score | Max Score |
|--------|-----------|-----------|
| A+ | 97 | 100 |
| A | 93 | 96.99 |
| A- | 90 | 92.99 |
| B+ | 87 | 89.99 |
| B | 83 | 86.99 |
| B- | 80 | 82.99 |
| C+ | 77 | 79.99 |
| C | 73 | 76.99 |
| C- | 70 | 72.99 |
| D+ | 67 | 69.99 |
| D | 60 | 66.99 |
| F | 0 | 59.99 |

## Internationalization

The feature supports both Arabic (RTL) and English (LTR) through the existing `LanguageContext`. All UI labels and messages have translations in both languages.

## Technical Implementation

### State Management
- Uses React `useState` for local state
- `useCallback` for memoized functions
- No backend/database integration (client-side only)

### Types
```typescript
interface GradeComponent {
  id: string;
  name: string;
  weight: number;
  scaleMax: number;
  aggregationRule: 'average' | 'sum' | 'drop_lowest' | 'best_of' | 'weighted';
  dropCount?: number;
  bestOf?: number;
  group: 'exam' | 'work';
  items: ComponentItem[];
}

interface ComponentItem {
  id: string;
  name: string;
  rawScore: number | null;
  maxScore: number;
  weight?: number;
}

interface CurveAdjustment {
  id: string;
  targetType: 'component' | 'overall';
  targetId?: string;
  adjustmentType: 'add' | 'multiply' | 'set';
  value: number;
  clamp: boolean;
}

interface ConstraintRule {
  id: string;
  name: string;
  type: 'min_exam' | 'cap_work' | 'min_component' | 'custom';
  formula?: string;
  threshold?: number;
  componentId?: string;
}
```

## UI Components Used

- **LiquidGlassCard**: Glassmorphism-styled container
- **Card**: Standard card component from shadcn/ui
- **Collapsible**: Expandable sections
- **Select**: Dropdown menus
- **Input**: Text and number inputs
- **Slider**: Range selection
- **Switch**: Toggle options
- **Badge**: Status indicators
- **Alert**: Warning and info messages
- **Tabs**: Section organization

## Future Enhancements

Potential improvements:
1. Save grading profiles per course
2. Link with existing courses in the system
3. Historical tracking of grade predictions
4. Export/import grading profiles
5. Template grading profiles for common course types
6. Resit/retake policy configuration
7. Class statistics for curve prediction
