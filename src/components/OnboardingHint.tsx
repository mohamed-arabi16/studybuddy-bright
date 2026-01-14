import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isCurrent: boolean;
  action?: {
    label: string;
    href: string;
  };
}

interface OnboardingHintProps {
  steps: OnboardingStep[];
  className?: string;
}

export function OnboardingHint({ steps, className }: OnboardingHintProps) {
  const { t, dir } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className={cn(
      "bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/20 rounded-xl p-6",
      className
    )}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">{t('hintGetStarted')}</h3>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          // Helper function to determine step container styles
          const getStepContainerStyles = () => {
            if (step.isCurrent) return "bg-primary/10 border border-primary/30";
            if (step.isComplete) return "bg-success/5 border border-success/20";
            return "bg-muted/30 border border-transparent";
          };

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-all duration-200",
                getStepContainerStyles()
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {step.isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border-2",
                    step.isCurrent ? "border-primary text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={cn(
                  "font-medium text-sm",
                  step.isComplete ? "text-success" : step.isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                {step.isCurrent && (
                  <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {t('currentStep')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </p>
              
              {step.isCurrent && step.action && (
                <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1">
                  <Link to={step.action.href}>
                    {step.action.label}
                    <ArrowIcon className="w-3 h-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
