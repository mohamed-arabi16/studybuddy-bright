import { BookOpen, Sparkles, TrendingUp } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface UsageIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function UsageIndicator({ compact = false, className }: UsageIndicatorProps) {
  const { usage, limits, planName, isLoading, isTrial, isPro } = useSubscription();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-24" />
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
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        <span className={cn(
          "font-medium",
          isAtLimit ? "text-destructive" : isNearLimit ? "text-warning" : "text-muted-foreground"
        )}>
          {coursesUsed}/{limitLabel}
        </span>
      </div>
    );
  }

  // Show "Pro Trial" for promo code users, "Free Trial" for regular trial
  const trialLabel = isPro && isTrial ? t('proTrial') : t('freeTrial');

  return (
    <div className={cn("p-3 rounded-lg bg-muted/50 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center",
            isTrial ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {isTrial ? <Sparkles className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
          </div>
          <div>
            <p className="text-xs font-medium">{planName}</p>
            {isTrial && <p className="text-[10px] text-muted-foreground">{trialLabel}</p>}
          </div>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          isAtLimit 
            ? "bg-destructive/10 text-destructive" 
            : isNearLimit 
              ? "bg-warning/10 text-warning" 
              : "bg-muted text-muted-foreground"
        )}>
          {coursesUsed}/{limitLabel} {t('courses_plural')}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div 
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              isAtLimit ? "bg-destructive" : isNearLimit ? "bg-warning" : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isNearLimit && !isAtLimit && (
          <p className="text-[10px] text-warning flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {t('nearLimit')}
          </p>
        )}
      </div>
    </div>
  );
}
