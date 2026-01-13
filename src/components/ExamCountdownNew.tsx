import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { exams } from '@/data/studySchedule';
import { GlassCard } from '@/components/ui/GlassCard';
import { TimeLeft, getTimeLeft, getUrgencyLevel } from '@/lib/timeUtils';

const urgencyStyles = {
  safe: {
    card: 'border-border/50',
    accent: 'text-foreground',
    badge: 'bg-success/10 text-success border-success/20',
  },
  warning: {
    card: 'border-warning/30',
    accent: 'text-warning',
    badge: 'bg-warning/10 text-warning border-warning/20',
  },
  urgent: {
    card: 'border-destructive/40',
    accent: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  critical: {
    card: 'border-destructive/60 animate-pulse-glow',
    accent: 'text-destructive',
    badge: 'bg-destructive text-destructive-foreground border-destructive',
  },
  past: {
    card: 'border-border/30 opacity-60',
    accent: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

export function ExamCountdownNew() {
  const [timesLeft, setTimesLeft] = useState<Record<string, TimeLeft>>({});

  useEffect(() => {
    const calculateTimes = () => {
      const times: Record<string, TimeLeft> = {};
      exams.forEach(exam => {
        times[exam.id] = getTimeLeft(exam.date);
      });
      setTimesLeft(times);
    };

    calculateTimes();
    const timer = setInterval(calculateTimes, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort exams: upcoming first, then by date
  const sortedExams = [...exams].sort((a, b) => {
    const timeA = timesLeft[a.id]?.total ?? 0;
    const timeB = timesLeft[b.id]?.total ?? 0;
    if (timeA <= 0 && timeB > 0) return 1;
    if (timeB <= 0 && timeA > 0) return -1;
    return a.date.getTime() - b.date.getTime();
  });

  // Get next upcoming exam
  const nextExam = sortedExams.find(e => (timesLeft[e.id]?.total ?? 0) > 0);

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        العد التنازلي للامتحانات
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedExams.map(exam => {
          const timeLeft = timesLeft[exam.id] || { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
          const urgency = getUrgencyLevel(timeLeft.days, timeLeft.total);
          const styles = urgencyStyles[urgency];
          const isNext = exam.id === nextExam?.id;

          const examTime = exam.date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });

          return (
            <GlassCard 
              key={exam.id} 
              className={`p-5 transition-all animate-fade-in ${styles.card} ${isNext ? 'ring-2 ring-primary/30' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    {exam.subjectAr}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {exam.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })} @ {examTime}
                  </p>
                </div>
                {isNext && urgency !== 'past' && (
                  <span className={`text-xs px-2 py-1 rounded-full border ${styles.badge}`}>
                    التالي
                  </span>
                )}
                {urgency === 'critical' && (
                  <AlertTriangle className="w-5 h-5 text-destructive animate-bounce" />
                )}
              </div>
              
              {urgency === 'past' ? (
                <div className="text-center py-2">
                  <p className="text-muted-foreground">انتهى الامتحان ✓</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <TimeUnit value={timeLeft.days} label="يوم" accent={styles.accent} />
                  <TimeUnit value={timeLeft.hours} label="ساعة" accent={styles.accent} />
                  <TimeUnit value={timeLeft.minutes} label="دقيقة" accent={styles.accent} />
                  <TimeUnit value={timeLeft.seconds} label="ثانية" accent={styles.accent} />
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function TimeUnit({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-background/50">
      <div className={`text-2xl font-bold ${accent} tabular-nums`}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
