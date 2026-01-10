import { useLocalStorage } from './useLocalStorage';

export function useCompletedTasks() {
  const [completedTasks, setCompletedTasks] = useLocalStorage<string[]>('completed-tasks', []);

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const isCompleted = (taskId: string) => completedTasks.includes(taskId);

  const getCompletedCount = (taskIds: string[]) => 
    taskIds.filter(id => completedTasks.includes(id)).length;

  return { completedTasks, toggleTask, isCompleted, getCompletedCount };
}
