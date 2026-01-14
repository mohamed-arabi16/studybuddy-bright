/**
 * Shared constants for urgency calculation in study planning functions.
 * These parameters control the exponential urgency decay curve used across
 * generate-smart-plan, generate-unified-plan, and generate-study-plan.
 */

/**
 * Sigmoid function parameters for urgency calculation.
 * The formula used is: 1 / (1 + e^(STEEPNESS * (days - MIDPOINT)))
 * 
 * URGENCY_SIGMOID_STEEPNESS (k):
 * - Higher values = steeper curve = more sudden transition
 * - Lower values = gentler curve = more gradual transition
 * - Default: 0.15 provides a balanced curve
 * 
 * URGENCY_SIGMOID_MIDPOINT (x₀):
 * - The number of days at which urgency is exactly 0.5
 * - Days < midpoint: urgency > 0.5 (critical zone)
 * - Days > midpoint: urgency < 0.5 (comfortable zone)
 * - Default: 10 days is the "warning threshold"
 */
export const URGENCY_SIGMOID_STEEPNESS = 0.15;
export const URGENCY_SIGMOID_MIDPOINT = 10;

/**
 * Urgency zone thresholds (in days)
 * These define the conceptual zones for study planning:
 */
export const URGENCY_ZONE = {
  /** Critical zone: < 7 days - maximum urgency */
  CRITICAL: 7,
  /** Warning zone: 7-14 days - high urgency */
  WARNING: 14,
  /** Comfortable zone: > 14 days - moderate urgency */
  COMFORTABLE: 21,
} as const;

/**
 * Weight distribution for priority scoring.
 * Used in generatePriorityScore and related functions.
 * Sum should equal 1.0 for normalized output.
 */
export const PRIORITY_WEIGHTS = {
  /** Weight for exam proximity urgency factor */
  URGENCY: 0.35,
  /** Weight for topic/course importance factor */
  IMPORTANCE: 0.30,
  /** Weight for difficulty factor (harder = earlier) */
  DIFFICULTY: 0.20,
  /** Weight for prerequisite chain depth factor */
  PREREQUISITE: 0.15,
} as const;

/**
 * Calculate urgency score using standardized sigmoid function.
 * Returns a value between 0 and 1, where:
 * - 1.0 = immediate urgency (exam very soon)
 * - 0.5 = moderate urgency (at midpoint)
 * - 0.0 = low urgency (exam far away)
 * 
 * @param daysUntilDeadline Number of days until exam/deadline
 * @param steepness Optional override for sigmoid steepness
 * @param midpoint Optional override for sigmoid midpoint
 * @returns Urgency score between 0 and 1
 */
export function calculateUrgencyScore(
  daysUntilDeadline: number,
  steepness: number = URGENCY_SIGMOID_STEEPNESS,
  midpoint: number = URGENCY_SIGMOID_MIDPOINT
): number {
  if (daysUntilDeadline <= 0) return 1.0;
  return 1 / (1 + Math.exp(steepness * (daysUntilDeadline - midpoint)));
}
