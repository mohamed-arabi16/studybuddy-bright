import { 
  Clock, TrendingUp, CheckCircle2, AlertTriangle, 
  Calendar, Zap, Target, BookOpen 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanMetrics {
  isPriorityMode: boolean;
  coverageRatio: number;
  totalRequiredHours: number;
  totalAvailableHours: number;
  topicsScheduled: number;
  topicsTotal: number;
  workloadIntensity: 'light' | 'moderate' | 'heavy' | 'overloaded';
  avgHoursPerStudyDay: number;
  studyDaysCreated: number;
  estimatedCompletionDate: string | null;
  suggestions: string[];
  urgentCoursesCount: number;
  warnings: string[];
}

interface PlanSummaryCardProps {
  metrics: PlanMetrics;
  totalPlanDays: number;
}

export function PlanSummaryCard({ metrics, totalPlanDays }: PlanSummaryCardProps) {
  const { t, dir, language } = useLanguage();
  
  const coveragePercent = Math.round(metrics.coverageRatio * 100);
  const topicsPercent = metrics.topicsTotal > 0 
    ? Math.round((metrics.topicsScheduled / metrics.topicsTotal) * 100) 
    : 100;

  const getWorkloadColor = (intensity: string) => {
    switch (intensity) {
      case 'light': return 'text-green-600 bg-green-50 dark:bg-green-950/30';
      case 'moderate': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30';
      case 'heavy': return 'text-amber-600 bg-amber-50 dark:bg-amber-950/30';
      case 'overloaded': return 'text-red-600 bg-red-50 dark:bg-red-950/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getWorkloadLabel = (intensity: string) => {
    if (language === 'ar') {
      switch (intensity) {
        case 'light': return 'خفيف';
        case 'moderate': return 'معتدل';
        case 'heavy': return 'مكثف';
        case 'overloaded': return 'مزدحم';
        default: return intensity;
      }
    }
    return intensity.charAt(0).toUpperCase() + intensity.slice(1);
  };

  const getWorkloadIcon = (intensity: string) => {
    switch (intensity) {
      case 'light': return CheckCircle2;
      case 'moderate': return TrendingUp;
      case 'heavy': return Zap;
      case 'overloaded': return AlertTriangle;
      default: return Target;
    }
  };

  const WorkloadIcon = getWorkloadIcon(metrics.workloadIntensity);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      // Fallback to raw date string if locale formatting fails
      return dateStr;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" dir={dir}>
      <CardContent className="p-4 space-y-4">
        {/* Header with main stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">
              {language === 'ar' ? 'ملخص الخطة' : 'Plan Summary'}
            </h3>
          </div>
          <Badge 
            variant="outline" 
            className={getWorkloadColor(metrics.workloadIntensity)}
          >
            <WorkloadIcon className="w-3 h-3 me-1" />
            {getWorkloadLabel(metrics.workloadIntensity)}
          </Badge>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Study Days */}
          <div className="text-center p-2 rounded-lg bg-background/60">
            <div className="text-2xl font-bold text-primary">
              {metrics.studyDaysCreated}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'يوم دراسة' : 'Study Days'}
            </div>
          </div>

          {/* Total Hours */}
          <div className="text-center p-2 rounded-lg bg-background/60">
            <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              {metrics.totalRequiredHours.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'إجمالي الساعات' : 'Total Hours'}
            </div>
          </div>

          {/* Topics Scheduled */}
          <div className="text-center p-2 rounded-lg bg-background/60">
            <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
              <BookOpen className="w-4 h-4" />
              {metrics.topicsScheduled}/{metrics.topicsTotal}
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'المواضيع' : 'Topics'}
            </div>
          </div>

          {/* Daily Average */}
          <div className="text-center p-2 rounded-lg bg-background/60">
            <div className="text-2xl font-bold text-primary">
              {metrics.avgHoursPerStudyDay}h
            </div>
            <div className="text-xs text-muted-foreground">
              {language === 'ar' ? 'معدل يومي' : 'Daily Avg'}
            </div>
          </div>
        </div>

        {/* Coverage Progress */}
        {metrics.isPriorityMode && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {language === 'ar' ? 'نسبة التغطية' : 'Coverage Ratio'}
              </span>
              <span className={`font-medium ${coveragePercent < 70 ? 'text-amber-600' : 'text-green-600'}`}>
                {coveragePercent}%
              </span>
            </div>
            <Progress 
              value={coveragePercent} 
              className={`h-2 ${coveragePercent < 70 ? '[&>div]:bg-amber-500' : ''}`}
            />
            {coveragePercent < 100 && (
              <p className="text-xs text-muted-foreground">
                {language === 'ar' 
                  ? 'تم ضغط وقت الدراسة لتناسب الوقت المتاح'
                  : 'Study time has been compressed to fit available time'}
              </p>
            )}
          </div>
        )}

        {/* Topic Coverage Progress */}
        {topicsPercent < 100 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {language === 'ar' ? 'المواضيع المجدولة' : 'Topics Scheduled'}
              </span>
              <span className={`font-medium ${topicsPercent < 80 ? 'text-amber-600' : 'text-green-600'}`}>
                {topicsPercent}%
              </span>
            </div>
            <Progress 
              value={topicsPercent} 
              className={`h-2 ${topicsPercent < 80 ? '[&>div]:bg-amber-500' : ''}`}
            />
          </div>
        )}

        {/* Estimated Completion */}
        {metrics.estimatedCompletionDate && (
          <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Target className="w-4 h-4" />
              <span>
                {language === 'ar' ? 'تاريخ الإتمام المتوقع' : 'Est. Completion'}
              </span>
            </div>
            <span className="font-medium text-green-700 dark:text-green-400">
              {formatDate(metrics.estimatedCompletionDate)}
            </span>
          </div>
        )}

        {/* Urgent Courses Alert */}
        {metrics.urgentCoursesCount > 0 && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {language === 'ar' 
                ? `${metrics.urgentCoursesCount} مادة لها امتحان خلال 7 أيام`
                : `${metrics.urgentCoursesCount} course(s) with exams in < 7 days`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
