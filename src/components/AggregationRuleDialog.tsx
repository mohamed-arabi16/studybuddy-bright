import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AggregationRuleDialogProps {
  children?: React.ReactNode;
}

export function AggregationRuleDialog({ children }: AggregationRuleDialogProps) {
  const { t, dir } = useLanguage();

  const rules = [
    {
      key: 'average',
      label: t('average'),
      explanation: t('averageExplanationDetailed'),
      example: '80 + 90 + 85 = 255 ÷ 3 = 85%',
      whenToUse: t('whenToUseAverage'),
    },
    {
      key: 'sum',
      label: t('sum'),
      explanation: t('sumExplanationDetailed'),
      example: '(25 + 18 + 22) / (30 + 20 + 25) = 65/75 = 86.7%',
      whenToUse: t('whenToUseSum'),
    },
    {
      key: 'drop_lowest',
      label: t('dropLowest'),
      explanation: t('dropLowestExplanationDetailed'),
      example: '[60, 80, 90, 95] → drop 60 → avg(80+90+95) = 88.3%',
      whenToUse: t('whenToUseDropLowest'),
    },
    {
      key: 'best_of',
      label: t('bestOf'),
      explanation: t('bestOfExplanationDetailed'),
      example: '5 quizzes, best 3 → only top 3 count',
      whenToUse: t('whenToUseBestOf'),
    },
    {
      key: 'weighted',
      label: t('weighted'),
      explanation: t('weightedExplanationDetailed'),
      example: 'Quiz1 (40%) = 80, Quiz2 (60%) = 90 → 0.4×80 + 0.6×90 = 86%',
      whenToUse: t('whenToUseWeighted'),
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <button className="p-1 hover:bg-muted rounded-md transition-colors" type="button">
            <Info className="w-4 h-4 text-primary cursor-pointer" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir={dir}>
        <DialogHeader className="text-start">
          <DialogTitle>{t('aggregationRuleTitle')}</DialogTitle>
          <DialogDescription>{t('aggregationRuleMainDesc')}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {rules.map((rule) => (
            <div key={rule.key} className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="font-medium text-foreground mb-2">{rule.label}</h4>
              <p className="text-sm text-muted-foreground mb-3">{rule.explanation}</p>
              <div className="text-xs p-2 bg-background rounded border border-border/30 font-mono">
                <span className="text-muted-foreground">{t('example')}:</span>{' '}
                <span className="text-foreground">{rule.example}</span>
              </div>
              <p className="text-xs text-primary mt-2">💡 {rule.whenToUse}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
