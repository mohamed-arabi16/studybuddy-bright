import { Sparkles, Zap } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';

interface CreditIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function CreditIndicator({ compact = false, className }: CreditIndicatorProps) {
  const { credits, isLoading, percentage, isLow, isExhausted } = useCredits();
  const { t, language } = useLanguage();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-24" />
      </div>
    );
  }

  if (!credits) {
    return null;
  }

  const planDisplayName = credits.planTier === 'pro' 
    ? 'Pro' 
    : credits.planTier === 'trial' 
      ? language === 'ar' ? 'تجربة Pro' : 'Pro Trial'
      : language === 'ar' ? 'مجاني' : 'Free';

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Zap className={cn(
          "w-4 h-4",
          isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
        )} />
        <span className={cn(
          "font-medium",
          isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-muted-foreground"
        )}>
          {credits.balance}/{credits.monthlyAllowance}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg bg-muted/50 space-y-3", className)}>
      {/* AI Credits Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center",
              isExhausted 
                ? "bg-destructive/20 text-destructive" 
                : isLow 
                  ? "bg-warning/20 text-warning" 
                  : "bg-primary/20 text-primary"
            )}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {language === 'ar' ? 'رصيد AI' : 'AI Credits'}
            </span>
          </div>
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            isExhausted 
              ? "bg-destructive/10 text-destructive" 
              : isLow 
                ? "bg-warning/10 text-warning" 
                : "bg-muted text-muted-foreground"
          )}>
            {credits.balance}/{credits.monthlyAllowance}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-1.5">
          <div 
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              isExhausted ? "bg-destructive" : isLow ? "bg-warning" : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Reset Date */}
        <p className="text-[10px] text-muted-foreground">
          {language === 'ar' ? 'يتجدد في' : 'Resets'} {format(credits.resetDate, 'MMM d')}
        </p>
      </div>

      {/* Plan Indicator */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center",
          credits.planTier === 'free' 
            ? "bg-muted text-muted-foreground" 
            : "bg-primary/20 text-primary"
        )}>
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-xs font-medium">{planDisplayName}</p>
          {credits.planTier === 'trial' && (
            <p className="text-[10px] text-muted-foreground">
              {t('proTrial')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
