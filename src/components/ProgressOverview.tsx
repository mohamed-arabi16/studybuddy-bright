import { Progress } from '@/components/ui/progress';
import { schedule } from '@/data/studySchedule';

interface ProgressOverviewProps {
  completedTasks: string[];
}

export function ProgressOverview({ completedTasks }: ProgressOverviewProps) {
  const allTasks = schedule.flatMap(day => [
    ...day.osTasks,
    ...day.circuitsTasks,
    ...day.automataTasks,
  ]);
  
  const subjectProgress = {
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

  const totalTasks = allTasks.length;
  const totalCompleted = completedTasks.filter(id => 
    allTasks.some(task => task.id === id)
  ).length;
  const overallPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <div className="bg-card border border-border p-4 mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4 text-right">التقدم العام</h3>
      
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">{overallPercentage}%</span>
          <span className="text-sm text-muted-foreground">
            {totalCompleted} / {totalTasks} مكتمل
          </span>
        </div>
        <Progress value={overallPercentage} className="h-3" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(subjectProgress) as Array<keyof typeof subjectProgress>).map(subject => {
          const { total, completed } = subjectProgress[subject];
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          const names = { os: 'OS', circuits: 'Circuits', automata: 'Automata' };
          
          return (
            <div key={subject} className="text-center">
              <div className="text-2xl font-bold text-foreground">{percentage}%</div>
              <div className="text-sm text-muted-foreground">{names[subject]}</div>
              <div className="text-xs text-muted-foreground">{completed}/{total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
