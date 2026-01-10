import { useState } from 'react';
import { ChevronDown, ChevronUp, CalendarDays, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { schedule } from '@/data/studySchedule';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ScheduleTableNewProps {
  completedTasks: string[];
  onToggleTask: (taskId: string) => void;
}

export function ScheduleTableNew({ completedTasks, onToggleTask }: ScheduleTableNewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const subjectColors = {
    os: 'border-l-primary',
    circuits: 'border-l-success',
    automata: 'border-l-warning',
  };

  return (
    <GlassCard className="mb-6 overflow-hidden animate-fade-in">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full p-5 flex items-center justify-between hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">الجدول التفصيلي</span>
              <span className="text-sm text-muted-foreground">
                ({schedule.length} يوم)
              </span>
            </div>
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-right p-4 text-foreground font-semibold whitespace-nowrap w-28">
                      التاريخ
                    </th>
                    <th className="text-right p-4 text-foreground font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        OS
                      </span>
                    </th>
                    <th className="text-right p-4 text-foreground font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        Circuits
                      </span>
                    </th>
                    <th className="text-right p-4 text-foreground font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-warning" />
                        Automata
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((day) => {
                    const isExamDay = day.osTasks.some(t => t.topic.includes('🎯')) || 
                                     day.circuitsTasks.some(t => t.topic.includes('🎯')) ||
                                     day.automataTasks.some(t => t.topic.includes('🎯'));
                    const isEmpty = day.osTasks.length === 0 && 
                                   day.circuitsTasks.length === 0 && 
                                   day.automataTasks.length === 0;

                    return (
                      <tr 
                        key={day.date} 
                        className={`border-b border-border/30 transition-colors ${
                          isExamDay 
                            ? 'bg-destructive/5 hover:bg-destructive/10' 
                            : isEmpty 
                              ? 'bg-muted/10 hover:bg-muted/20' 
                              : 'hover:bg-muted/10'
                        }`}
                      >
                        <td className="p-4 text-foreground font-medium whitespace-nowrap">
                          <div>
                            <span className="text-foreground">{day.date}</span>
                            <span className="text-muted-foreground mr-2 text-xs">{day.dayAr}</span>
                          </div>
                        </td>
                        <td className={`p-4 border-r-4 ${subjectColors.os}`}>
                          <TaskList 
                            tasks={day.osTasks} 
                            completedTasks={completedTasks}
                            onToggleTask={onToggleTask}
                          />
                        </td>
                        <td className={`p-4 border-r-4 ${subjectColors.circuits}`}>
                          <TaskList 
                            tasks={day.circuitsTasks} 
                            completedTasks={completedTasks}
                            onToggleTask={onToggleTask}
                          />
                        </td>
                        <td className={`p-4 border-r-4 ${subjectColors.automata}`}>
                          <TaskList 
                            tasks={day.automataTasks} 
                            completedTasks={completedTasks}
                            onToggleTask={onToggleTask}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </GlassCard>
  );
}

interface TaskListProps {
  tasks: Array<{ id: string; topic: string; hasQuizLink?: string }>;
  completedTasks: string[];
  onToggleTask: (taskId: string) => void;
}

function TaskList({ tasks, completedTasks, onToggleTask }: TaskListProps) {
  if (tasks.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => {
        const isCompleted = completedTasks.includes(task.id);
        const isExam = task.topic.includes('🎯');

        return (
          <div key={task.id} className="flex items-start gap-2">
            {!isExam && (
              <Checkbox 
                checked={isCompleted}
                onCheckedChange={() => onToggleTask(task.id)}
                className="mt-0.5 shrink-0"
              />
            )}
            <span className={`text-sm leading-relaxed ${
              isCompleted 
                ? 'line-through text-muted-foreground' 
                : isExam 
                  ? 'font-bold text-destructive' 
                  : 'text-foreground'
            }`}>
              {task.topic}
              {task.hasQuizLink && (
                <ExternalLink className="inline-block w-3 h-3 mr-1 text-muted-foreground" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
