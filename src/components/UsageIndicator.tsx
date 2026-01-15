import { BookOpen, TrendingUp } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';

interface UsageIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function UsageIndicator({ compact = false, className }: UsageIndicatorProps) {
  const { usage, limits, isLoading } = useSubscription();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className={cn("p-3 rounded-lg bg-white/5 border border-white/10", className)}>
        <Skeleton className="h-4 w-24 bg-white/10" />
      </div>
    );
  }

  const coursesUsed = usage.courses;
  const coursesLimit = limits.courses;

  const isUnlimited = coursesLimit === -1;
  const limitLabel = isUnlimited ? '∞' : String(coursesLimit);

  const percentage = !isUnlimited && coursesLimit > 0
    ? Math.min((coursesUsed / coursesLimit) * 100, 100)
    : 0;

  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && coursesUsed >= coursesLimit;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <BookOpen className="w-4 h-4 text-white/50" />
        <span className={cn(
          "font-medium",
          isAtLimit ? "text-destructive" : isNearLimit ? "text-orange-400" : "text-white/60"
        )}>
          {coursesUsed}/{limitLabel}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg bg-white/5 border border-white/10 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-white/50" />
          <span className="text-xs font-medium text-white/80">{t('courses_plural')}</span>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full border",
          isAtLimit 
            ? "bg-destructive/20 text-destructive border-destructive/30" 
            : isNearLimit 
              ? "bg-orange-500/20 text-orange-400 border-orange-500/30" 
              : "bg-white/10 text-white/60 border-white/10"
        )}>
          {coursesUsed}/{limitLabel}
        </span>
      </div>
      
      {/* Progress Bar - only show if not unlimited */}
      {!isUnlimited && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div 
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isAtLimit ? "bg-destructive" : isNearLimit ? "bg-orange-500" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {isNearLimit && !isAtLimit && (
            <p className="text-[10px] text-orange-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {t('nearLimit')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
