import { Checkbox } from '@/components/ui/checkbox';
import { schedule } from '@/data/studySchedule';

interface DailyScheduleTableProps {
  completedTasks: string[];
  onToggleTask: (taskId: string) => void;
}

export function DailyScheduleTable({ completedTasks, onToggleTask }: DailyScheduleTableProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-2 text-end">
        2) الخطة اليومية (كل يوم + كل مادة) — على شكل جدول
      </h2>
      <p className="text-muted-foreground text-sm mb-4 text-end">
        القاعدة: كل يوم إله "مادة رئيسية" (عادة OS قبل 9/1)، ويبقى للمواد "جرعات مسائل" حتى ما تتراكم.
      </p>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="text-end p-3 text-foreground font-semibold whitespace-nowrap">التاريخ + اليوم</th>
              <th className="text-end p-3 text-foreground font-semibold">OS (المادة الرئيسية قبل 9/1)</th>
              <th className="text-end p-3 text-foreground font-semibold">Circuits (جرعة مسائل)</th>
              <th className="text-end p-3 text-foreground font-semibold">Automata (جرعة مركزة على كويزاتك)</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((day) => {
              const isExamDay = day.osTasks.some(t => t.topic.includes('🎯')) || 
                               day.circuitsTasks.some(t => t.topic.includes('🎯')) ||
                               day.automataTasks.some(t => t.topic.includes('🎯'));
              const isEmpty = day.osTasks.length === 0 && day.circuitsTasks.length === 0 && day.automataTasks.length === 0;

              return (
                <tr 
                  key={day.date} 
                  className={`border-b border-border ${isExamDay ? 'bg-destructive/10' : isEmpty ? 'bg-muted/20' : ''}`}
                >
                  <td className="p-3 text-foreground font-medium whitespace-nowrap">
                    {day.date} {day.dayAr}
                  </td>
                  <td className="p-3">
                    {day.osTasks.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      day.osTasks.map(task => (
                        <TaskItem 
                          key={task.id}
                          task={task}
                          isCompleted={completedTasks.includes(task.id)}
                          onToggle={() => onToggleTask(task.id)}
                        />
                      ))
                    )}
                  </td>
                  <td className="p-3">
                    {day.circuitsTasks.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      day.circuitsTasks.map(task => (
                        <TaskItem 
                          key={task.id}
                          task={task}
                          isCompleted={completedTasks.includes(task.id)}
                          onToggle={() => onToggleTask(task.id)}
                        />
                      ))
                    )}
                  </td>
                  <td className="p-3">
                    {day.automataTasks.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      day.automataTasks.map(task => (
                        <TaskItem 
                          key={task.id}
                          task={task}
                          isCompleted={completedTasks.includes(task.id)}
                          onToggle={() => onToggleTask(task.id)}
                        />
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: { id: string; topic: string; hasQuizLink?: string };
  isCompleted: boolean;
  onToggle: () => void;
}

function TaskItem({ task, isCompleted, onToggle }: TaskItemProps) {
  const isExam = task.topic.includes('🎯');

  return (
    <div className="flex items-start gap-2 mb-1">
      {!isExam && (
        <Checkbox 
          checked={isCompleted}
          onCheckedChange={onToggle}
          className="mt-0.5 shrink-0"
        />
      )}
      <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'} ${isExam ? 'font-bold' : ''}`}>
        {task.topic}
        {task.hasQuizLink && (
          <span className="text-xs text-muted-foreground me-1"> 📎</span>
        )}
      </span>
    </div>
  );
}
