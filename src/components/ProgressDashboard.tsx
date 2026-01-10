import { TrendingUp, BookOpen, Cpu, Workflow } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { GlassCard } from '@/components/ui/GlassCard';
import { schedule } from '@/data/studySchedule';

interface ProgressDashboardProps {
  completedTasks: string[];
}

export function ProgressDashboard({ completedTasks }: ProgressDashboardProps) {
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

  const subjectConfig = {
    os: { 
      name: 'Operating Systems', 
      icon: Cpu, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      progressColor: 'bg-primary',
    },
    circuits: { 
      name: 'Circuits', 
      icon: Workflow, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      progressColor: 'bg-success',
    },
    automata: { 
      name: 'Automata', 
      icon: BookOpen, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      progressColor: 'bg-warning',
    },
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        نظرة عامة على التقدم
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Overall Progress */}
        <GlassCard className="p-5 lg:col-span-1 animate-fade-in">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted/30"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallPercentage / 100)}`}
                  className="text-primary transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{overallPercentage}%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalCompleted} / {totalTasks} مهمة
            </p>
            <p className="text-xs text-muted-foreground mt-1">التقدم الكلي</p>
          </div>
        </GlassCard>

        {/* Subject Progress Cards */}
        {(Object.keys(subjectProgress) as Array<keyof typeof subjectProgress>).map((subject) => {
          const { total, completed } = subjectProgress[subject];
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          const config = subjectConfig[subject];
          const Icon = config.icon;
          
          return (
            <GlassCard key={subject} className="p-5 animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{config.name}</h4>
                  <p className="text-xs text-muted-foreground">{completed}/{total} مهمة</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={`font-semibold ${config.color}`}>{percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${config.progressColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
