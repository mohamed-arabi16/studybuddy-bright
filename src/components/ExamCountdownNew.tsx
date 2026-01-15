import { useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { exams } from '@/data/studySchedule';
import { GlassCard } from '@/components/ui/GlassCard';
import { useCountdown } from '@/hooks/useCountdown';
import { getUrgencyLevel } from '@/lib/timeUtils';

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

// Individual exam card using shared countdown hook
function ExamCardNew({ exam, isNext }: { exam: typeof exams[0]; isNext: boolean }) {
  const timeLeft = useCountdown(exam.date);
  const urgency = getUrgencyLevel(timeLeft.days, timeLeft.total);
  const styles = urgencyStyles[urgency];

  const examTime = exam.date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <GlassCard 
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
}

export function ExamCountdownNew() {
  // Sort exams: upcoming first, then by date
  // Memoize to avoid re-sorting on every render
  const sortedExams = useMemo(() => {
    return [...exams].sort((a, b) => {
      const now = Date.now();
      const timeA = a.date.getTime() - now;
      const timeB = b.date.getTime() - now;
      if (timeA <= 0 && timeB > 0) return 1;
      if (timeB <= 0 && timeA > 0) return -1;
      return a.date.getTime() - b.date.getTime();
    });
  }, []);

  // Get next upcoming exam
  const nextExamId = useMemo(() => {
    const nextExam = sortedExams.find(e => e.date.getTime() > Date.now());
    return nextExam?.id;
  }, [sortedExams]);

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        العد التنازلي للامتحانات
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedExams.map(exam => (
          <ExamCardNew 
            key={exam.id} 
            exam={exam} 
            isNext={exam.id === nextExamId}
          />
        ))}
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
