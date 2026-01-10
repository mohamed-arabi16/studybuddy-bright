import { Lightbulb, Brain, Coffee, Timer, Target, Book } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Tip {
  icon: typeof Lightbulb;
  titleKey: string;
  descriptionKey: string;
}

const studyTips: Tip[] = [
  {
    icon: Brain,
    titleKey: 'tipActiveRecallTitle',
    descriptionKey: 'tipActiveRecallDesc',
  },
  {
    icon: Timer,
    titleKey: 'tipPomodoroTitle',
    descriptionKey: 'tipPomodoroDesc',
  },
  {
    icon: Target,
    titleKey: 'tipPrioritizeTitle',
    descriptionKey: 'tipPrioritizeDesc',
  },
  {
    icon: Coffee,
    titleKey: 'tipHydratedTitle',
    descriptionKey: 'tipHydratedDesc',
  },
  {
    icon: Book,
    titleKey: 'tipSpacedRepTitle',
    descriptionKey: 'tipSpacedRepDesc',
  },
];

export function StudyTipsSection() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-3">
      {studyTips.map((tip, index) => {
        const Icon = tip.icon;
        return (
          <div 
            key={index} 
            className="flex gap-3 p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-0.5">{t(tip.titleKey)}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(tip.descriptionKey)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}