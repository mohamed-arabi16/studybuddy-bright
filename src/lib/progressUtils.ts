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

/**
 * Calculate progress for each subject based on completed tasks
 * @param completedTasks - Array of completed task IDs
 * @returns Object containing progress for each subject
 */
export function calculateSubjectProgress(completedTasks: string[]): SubjectProgressMap {
  const allTasks = schedule.flatMap(day => [
    ...day.osTasks,
    ...day.circuitsTasks,
    ...day.automataTasks,
  ]);
  
  const subjectProgress: SubjectProgressMap = {
    os: { total: 0, completed: 0 },
    circuits: { total: 0, completed: 0 },
    automata: { total: 0, completed: 0 },
  };

  allTasks.forEach(task => {
    subjectProgress[task.subject].total++;
    if (completedTasks.includes(task.id)) {
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
  const allTasks = schedule.flatMap(day => [
    ...day.osTasks,
    ...day.circuitsTasks,
    ...day.automataTasks,
  ]);

  const totalTasks = allTasks.length;
  const totalCompleted = completedTasks.filter(id => 
    allTasks.some(task => task.id === id)
  ).length;
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
