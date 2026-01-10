import { Link } from 'react-router-dom';
import { 
  Sparkles, CheckCircle2, Zap, Brain, Calendar, 
  TrendingUp, ArrowRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface UpgradeCardProps {
  variant?: 'inline' | 'modal' | 'full';
  trigger?: 'course_limit' | 'ai_limit' | 'general';
  onUpgrade?: () => void;
  className?: string;
}

export function UpgradeCard({ 
  variant = 'inline', 
  trigger = 'general',
  onUpgrade,
  className 
}: UpgradeCardProps) {
  const { planName, isTrial } = useSubscription();
  const { t, dir } = useLanguage();

  const benefitsByTrigger = {
    course_limit: [
      { icon: Calendar, text: t('benefits_course_limit_1') },
      { icon: Brain, text: t('benefits_course_limit_2') },
      { icon: TrendingUp, text: t('benefits_course_limit_3') },
    ],
    ai_limit: [
      { icon: Brain, text: t('benefits_ai_limit_1') },
      { icon: Sparkles, text: t('benefits_ai_limit_2') },
      { icon: Zap, text: t('benefits_ai_limit_3') },
    ],
    general: [
      { icon: Calendar, text: t('benefits_general_1') },
      { icon: Brain, text: t('benefits_general_2') },
      { icon: TrendingUp, text: t('benefits_general_3') },
    ],
  };

  const titlesByTrigger = {
    course_limit: t('title_course_limit'),
    ai_limit: t('title_ai_limit'),
    general: t('title_general'),
  };

  const subtitlesByTrigger = {
    course_limit: t('subtitle_course_limit'),
    ai_limit: t('subtitle_ai_limit'),
    general: t('subtitle_general'),
  };

  const benefits = benefitsByTrigger[trigger];
  const title = titlesByTrigger[trigger];
  const subtitle = subtitlesByTrigger[trigger];

  if (variant === 'inline') {
    return (
      <div className={cn(
        "p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20",
        className
      )} dir={dir}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {subtitle}
            </p>
            <Button size="sm" className="gap-2" onClick={onUpgrade}>
              {t('upgradePlan')}
              <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className={cn("text-center space-y-6", className)} dir={dir}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        
        <div>
          <Badge variant="secondary" className="mb-3">
            {isTrial ? t('youAreInTrial') : `${t('planNamePrefix')} ${planName}`}
          </Badge>
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="space-y-3 text-right">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{benefit.text}</span>
              <CheckCircle2 className={`w-4 h-4 text-primary ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`} />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full gap-2" onClick={onUpgrade}>
            <Zap className="w-4 h-4" />
            {t('upgradeNow')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('cancelAnytime')}
          </p>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <Card className={cn("overflow-hidden", className)} dir={dir}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">{benefit.text}</span>
            </div>
          ))}
        </div>
        <Button className="w-full gap-2" onClick={onUpgrade}>
          <Zap className="w-4 h-4" />
          {t('upgradePlan')}
        </Button>
      </CardContent>
    </Card>
  );
}

// Soft limit warning component
interface SoftLimitWarningProps {
  current: number;
  limit: number;
  type: 'courses' | 'topics' | 'ai';
  className?: string;
}

export function SoftLimitWarning({ current, limit, type, className }: SoftLimitWarningProps) {
  const { t, dir } = useLanguage();
  const percentage = (current / limit) * 100;
  
  if (percentage < 70) return null;

  const messages = {
    courses: {
      warning: t('limit_warning_courses').replace('{current}', current.toString()).replace('{limit}', limit.toString()),
      critical: t('limit_critical_courses'),
      limit: t('limit_reached_courses'),
    },
    topics: {
      warning: t('limit_warning_topics').replace('{current}', current.toString()).replace('{limit}', limit.toString()),
      critical: t('limit_critical_topics'),
      limit: t('limit_reached_topics'),
    },
    ai: {
      warning: t('limit_warning_ai').replace('{current}', current.toString()).replace('{limit}', limit.toString()),
      critical: t('limit_critical_ai'),
      limit: t('limit_reached_ai'),
    },
  };

  const getMessage = () => {
    if (current >= limit) return messages[type].limit;
    if (current === limit - 1) return messages[type].critical;
    return messages[type].warning;
  };

  const isAtLimit = current >= limit;
  const isCritical = current === limit - 1;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
      isAtLimit 
        ? "bg-destructive/10 text-destructive border border-destructive/20" 
        : isCritical 
          ? "bg-warning/10 text-warning border border-warning/20"
          : "bg-muted text-muted-foreground",
      className
    )} dir={dir}>
      {isAtLimit ? (
        <Zap className="w-3.5 h-3.5" />
      ) : (
        <TrendingUp className="w-3.5 h-3.5" />
      )}
      <span>{getMessage()}</span>
      {isAtLimit && (
        <Button variant="link" size="sm" className={`h-auto p-0 text-xs ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`} asChild>
          <Link to="/app/settings">{t('upgrade')}</Link>
        </Button>
      )}
    </div>
  );
}
