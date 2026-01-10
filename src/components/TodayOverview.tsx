import { Calendar, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { schedule, StudyTask } from '@/data/studySchedule';
import { Checkbox } from '@/components/ui/checkbox';

interface TodayOverviewProps {
  completedTasks: string[];
  onToggleTask: (taskId: string) => void;
}

function getTodaySchedule() {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const dateStr = `${day}/${month}`;
  
  return schedule.find(d => d.date === dateStr);
}

export function TodayOverview({ completedTasks, onToggleTask }: TodayOverviewProps) {
  const todaySchedule = getTodaySchedule();
  
  const today = new Date();
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = dayNames[today.getDay()];
  const dateStr = today.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });

  const allTodayTasks: StudyTask[] = todaySchedule 
    ? [...todaySchedule.osTasks, ...todaySchedule.circuitsTasks, ...todaySchedule.automataTasks]
    : [];
  
  const completedCount = allTodayTasks.filter(t => completedTasks.includes(t.id)).length;
  const totalCount = allTodayTasks.length;

  const subjectColors = {
    os: 'bg-primary/10 text-primary border-primary/20',
    circuits: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    automata: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  // Arabic subject names
  const subjectNames = {
    os: 'نظم التشغيل',
    circuits: 'الدوائر',
    automata: 'الأتمتة',
  };

  return (
    <GlassCard className="p-6 mb-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">اليوم - {dayName}</h2>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
        {totalCount > 0 && (
          <div className="mr-auto flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-muted-foreground">
              {completedCount}/{totalCount} مكتمل
            </span>
          </div>
        )}
      </div>

      {allTodayTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg">لا توجد مهام مجدولة لليوم</p>
          <p className="text-sm">استمتع بيومك! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTodayTasks.map(task => {
            const isCompleted = completedTasks.includes(task.id);
            const isExam = task.topic.includes('🎯');
            
            return (
              <div 
                key={task.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  isCompleted 
                    ? 'bg-muted/30 border-border/30' 
                    : isExam 
                      ? 'bg-destructive/5 border-destructive/20'
                      : 'bg-background/50 border-border/50 hover:border-primary/30'
                }`}
              >
                {!isExam && (
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => onToggleTask(task.id)}
                    className="mt-0.5"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border text-right ${subjectColors[task.subject]}`}>
                      {subjectNames[task.subject]}
                    </span>
                    {isExam && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        امتحان
                      </span>
                    )}
                  </div>
                  <p className={`text-sm text-right ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.topic}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}