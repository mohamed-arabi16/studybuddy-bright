import { Progress } from '@/components/ui/progress';
import { 
  calculateSubjectProgress, 
  calculateOverallProgress, 
  calculatePercentage,
  SubjectProgressMap 
} from '@/lib/progressUtils';

interface ProgressOverviewProps {
  completedTasks: string[];
}

export function ProgressOverview({ completedTasks }: ProgressOverviewProps) {
  const subjectProgress = calculateSubjectProgress(completedTasks);
  const { totalTasks, totalCompleted, overallPercentage } = calculateOverallProgress(completedTasks);

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
        {(Object.keys(subjectProgress) as Array<keyof SubjectProgressMap>).map(subject => {
          const progress = subjectProgress[subject];
          const percentage = calculatePercentage(progress);
          const names = { os: 'OS', circuits: 'Circuits', automata: 'Automata' };
          
          return (
            <div key={subject} className="text-center">
              <div className="text-2xl font-bold text-foreground">{percentage}%</div>
              <div className="text-sm text-muted-foreground">{names[subject]}</div>
              <div className="text-xs text-muted-foreground">{progress.completed}/{progress.total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
