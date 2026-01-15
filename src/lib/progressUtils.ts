import { schedule } from '@/data/studySchedule';

/**
 * Subject progress tracking
 */
export interface SubjectProgress {
  total: number;
  completed: number;
}

/**
 * Progress by subject
 */
export interface SubjectProgressMap {
  os: SubjectProgress;
  circuits: SubjectProgress;
  automata: SubjectProgress;
}

// Pre-compute all tasks once at module load to avoid repeated flatMap operations
const allTasks = schedule.flatMap(day => [
  ...day.osTasks,
  ...day.circuitsTasks,
  ...day.automataTasks,
]);

// Create a Set of valid task IDs for O(1) lookup
const validTaskIds = new Set(allTasks.map(task => task.id));

/**
 * Calculate progress for each subject based on completed tasks
 * @param completedTasks - Array of completed task IDs
 * @returns Object containing progress for each subject
 */
export function calculateSubjectProgress(completedTasks: string[]): SubjectProgressMap {
  // Convert to Set for O(1) lookup instead of O(n) Array.includes()
  const completedSet = new Set(completedTasks);
  
  const subjectProgress: SubjectProgressMap = {
    os: { total: 0, completed: 0 },
    circuits: { total: 0, completed: 0 },
    automata: { total: 0, completed: 0 },
  };

  allTasks.forEach(task => {
    subjectProgress[task.subject].total++;
    if (completedSet.has(task.id)) {
      subjectProgress[task.subject].completed++;
    }
  });

  return subjectProgress;
}

/**
 * Calculate overall progress statistics
 * @param completedTasks - Array of completed task IDs
 * @returns Object containing overall progress statistics
 */
export function calculateOverallProgress(completedTasks: string[]): {
  totalTasks: number;
  totalCompleted: number;
  overallPercentage: number;
} {
  // Convert to Set for O(1) lookup instead of O(n) Array.includes()
  const completedSet = new Set(completedTasks);

  const totalTasks = allTasks.length;
  // Count completed tasks that are valid (exist in our task list) - O(n) instead of O(n²)
  let totalCompleted = 0;
  for (const id of completedTasks) {
    if (validTaskIds.has(id)) {
      totalCompleted++;
    }
  }
  const overallPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return { totalTasks, totalCompleted, overallPercentage };
}

/**
 * Calculate percentage for a subject
 * @param progress - SubjectProgress object
 * @returns Percentage (0-100)
 */
export function calculatePercentage(progress: SubjectProgress): number {
  return progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
}
