import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useCompletedTasks() {
  const [completedTasks, setCompletedTasks] = useLocalStorage<string[]>('completed-tasks', []);

  // Memoize the Set for O(1) lookups
  const completedTasksSet = useMemo(() => new Set(completedTasks), [completedTasks]);

  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, [setCompletedTasks]);

  // O(1) lookup using Set instead of O(n) Array.includes()
  const isCompleted = useCallback((taskId: string) => completedTasksSet.has(taskId), [completedTasksSet]);

  const getCompletedCount = useCallback((taskIds: string[]) => 
    taskIds.filter(id => completedTasksSet.has(id)).length,
  [completedTasksSet]);

  return { completedTasks, toggleTask, isCompleted, getCompletedCount };
}
