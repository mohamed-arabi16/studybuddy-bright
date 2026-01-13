import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { TimeLeft, getTimeLeft } from '@/lib/timeUtils';

interface ExamCountdownCardProps {
  course: {
    id: string;
    title: string;
    exam_date: string | null;
    color: string;
    topics: { id: string; status: string }[];
  };
  isFirst?: boolean;
}

export function ExamCountdownCard({ course, isFirst = false }: ExamCountdownCardProps) {
  const { t, language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    if (!course.exam_date) return;

    const calculateTimeLeft = () => getTimeLeft(new Date(course.exam_date!));

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [course.exam_date]);

  if (!course.exam_date) return null;

  const completedTopics = course.topics?.filter(t => t.status === 'done').length || 0;
  const totalTopics = course.topics?.length || 0;
  const progress = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
  
  const isUrgent = timeLeft.days <= 7 && timeLeft.total > 0;
  const isVeryUrgent = timeLeft.days <= 3 && timeLeft.total > 0;
  const isEnded = timeLeft.total <= 0;

  return (
    <Link to={`/app/courses/${course.id}`} className="block group">
      <LiquidGlassCard className={`p-5 transition-all duration-300 hover:scale-[1.02] ${
        isVeryUrgent ? 'ring-2 ring-destructive/50' : 
        isUrgent ? 'ring-1 ring-warning/50' : ''
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: course.color || 'hsl(var(--primary))' }}
            />
            <div>
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                {course.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {new Date(course.exam_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                  weekday: 'short', month: 'short', day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {isFirst && !isEnded && (
              <Badge variant="secondary" className="text-[10px] px-1.5">{t('nextExam')}</Badge>
            )}
            {isVeryUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t('urgent')}
              </Badge>
            )}
          </div>
        </div>

        {/* Countdown */}
        {isEnded ? (
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">{t('examCompleted')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { value: timeLeft.days, label: t('daysShort') },
              { value: timeLeft.hours, label: t('hoursShort') },
              { value: timeLeft.minutes, label: t('minutesShort') },
              { value: timeLeft.seconds, label: t('secondsShort') },
            ].map((item) => (
              <div 
                key={item.label} 
                className={`text-center p-2 rounded-lg ${
                  isVeryUrgent ? 'bg-destructive/10' : 'bg-muted/30'
                }`}
              >
                <div className={`text-lg font-bold tabular-nums ${
                  isVeryUrgent ? 'text-destructive' : ''
                }`}>
                  {String(item.value).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('progress')}</span>
            <span className="font-medium">{completedTopics}/{totalTopics} {t('topics')}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('percentComplete').replace('{percent}', String(Math.round(progress)))}</span>
            {!isEnded && timeLeft.days > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('topicsNeededPerDay').replace('{count}', String(Math.ceil((totalTopics - completedTopics) / timeLeft.days)))}
              </span>
            )}
          </div>
        </div>
      </LiquidGlassCard>
    </Link>
  );
}
