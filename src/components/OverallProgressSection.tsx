import { useMemo } from 'react';
import { TrendingUp, BookOpen, Target, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { useLanguage } from '@/contexts/LanguageContext';

interface Course {
  id: string;
  title: string;
  color: string;
  topics: { id: string; status: string }[];
}

interface OverallProgressSectionProps {
  courses: Course[];
}

export function OverallProgressSection({ courses }: OverallProgressSectionProps) {
  const { t } = useLanguage();
  
  const stats = useMemo(() => {
    const totalTopics = courses.reduce((sum, c) => sum + (c.topics?.length || 0), 0);
    const completedTopics = courses.reduce(
      (sum, c) => sum + (c.topics?.filter(t => t.status === 'done').length || 0), 
      0
    );
    const inProgressTopics = courses.reduce(
      (sum, c) => sum + (c.topics?.filter(t => t.status === 'in_progress').length || 0), 
      0
    );
    const overallProgress = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;

    return {
      totalTopics,
      completedTopics,
      inProgressTopics,
      pendingTopics: totalTopics - completedTopics - inProgressTopics,
      overallProgress,
      totalCourses: courses.length,
    };
  }, [courses]);

  const courseProgress = useMemo(() => {
    return courses.map(course => {
      const total = course.topics?.length || 0;
      const completed = course.topics?.filter(t => t.status === 'done').length || 0;
      return {
        id: course.id,
        title: course.title,
        color: course.color,
        progress: total > 0 ? (completed / total) * 100 : 0,
        completed,
        total,
      };
    });
  }, [courses]);

  return (
    <LiquidGlassCard className="p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
        <h2 className="font-medium">{t('overallProgress')}</h2>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-primary">{Math.round(stats.overallProgress)}%</div>
          <div className="text-xs text-muted-foreground">{t('complete')}</div>
        </div>
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{stats.completedTopics}</div>
          <div className="text-xs text-muted-foreground">{t('done')}</div>
        </div>
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-warning">{stats.inProgressTopics}</div>
          <div className="text-xs text-muted-foreground">{t('inProgress')}</div>
        </div>
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{stats.pendingTopics}</div>
          <div className="text-xs text-muted-foreground">{t('pending')}</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">{t('totalProgressLabel')}</span>
          <span className="font-medium">{stats.completedTopics}/{stats.totalTopics} {t('topics')}</span>
        </div>
        <Progress value={stats.overallProgress} className="h-2" />
      </div>

      {/* Per-Course Progress */}
      {courseProgress.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            {t('byCourse')}
          </h3>
          <div className="space-y-2">
            {courseProgress.map(course => (
              <div key={course.id} className="flex items-center gap-3">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: course.color || 'hsl(var(--primary))' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="truncate font-medium">{course.title}</span>
                    <span className="text-muted-foreground ml-2">{Math.round(course.progress)}%</span>
                  </div>
                  <Progress value={course.progress} className="h-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </LiquidGlassCard>
  );
}
