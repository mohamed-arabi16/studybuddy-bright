import { useCredits } from '@/hooks/useCredits';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface CreditIndicatorProps {
  className?: string;
}

export function CreditIndicator({ className }: CreditIndicatorProps) {
  const { credits, isLoading, getResetDate } = useCredits();
  const { t, language } = useLanguage();

  if (isLoading) {
    return (
      <div className={cn("p-3 rounded-lg bg-white/5 border border-white/10 space-y-2", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (!credits) {
    return null;
  }

  const percentage = credits.monthlyAllowance > 0 
    ? (credits.balance / credits.monthlyAllowance) * 100 
    : 0;
  const isLow = percentage <= 20 && percentage > 0;
  const isExhausted = credits.balance === 0;
  
  const resetDate = getResetDate();
  const dateLocale = language === 'ar' ? ar : enUS;

  // Color classes based on status
  const getProgressColor = () => {
    if (isExhausted) return 'bg-destructive';
    if (isLow) return 'bg-orange-500';
    return 'bg-primary';
  };

  const getBadgeClasses = () => {
    if (isExhausted) return 'bg-destructive/20 text-destructive border-destructive/30';
    if (isLow) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-primary/20 text-primary border-primary/30';
  };

  return (
    <div className={cn(
      "p-3 rounded-lg bg-white/5 border border-white/10 space-y-2.5",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-white/80">
            {t('aiUsage')}
          </span>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full border",
          getBadgeClasses()
        )}>
          {credits.balance} / {credits.monthlyAllowance}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div 
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            getProgressColor()
          )}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>

      {/* Reset Date */}
      <div className="flex items-center justify-between text-[10px] text-white/50">
        <span>
          {t('resetsOn')} {format(resetDate, 'MMM d', { locale: dateLocale })}
        </span>
        {isLow && !isExhausted && (
          <span className="flex items-center gap-1 text-orange-400">
            <TrendingUp className="w-3 h-3" />
            {t('lowCredits')}
          </span>
        )}
        {isExhausted && (
          <span className="text-destructive font-medium">
            {t('noCreditsLeft')}
          </span>
        )}
      </div>

      {/* Plan Tier Badge */}
      <div className="pt-1.5 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide",
            credits.planTier === 'pro' ? 'bg-primary/20 text-primary' :
            credits.planTier === 'trial' ? 'bg-purple-500/20 text-purple-400' :
            'bg-white/10 text-white/60'
          )}>
            {credits.planTier === 'trial' ? t('trial') : 
             credits.planTier === 'pro' ? 'Pro' : 
             credits.planTier.toUpperCase()}
          </span>
          <span className="text-[10px] text-white/40">
            {credits.monthlyAllowance} {t('creditsPerMonth')}
          </span>
        </div>
      </div>
    </div>
  );
}
