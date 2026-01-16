import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BookOpen, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface FreeUserUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

export function FreeUserUpgradeDialog({ open, onOpenChange, onContinue }: FreeUserUpgradeDialogProps) {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();

  const benefits = [
    {
      icon: BookOpen,
      title: t('saveGrades'),
      desc: t('saveGradesDescFull'),
    },
    {
      icon: TrendingUp,
      title: t('trackPerformance'),
      desc: t('trackPerformanceDescFull'),
    },
    {
      icon: BarChart3,
      title: t('compareGrades'),
      desc: t('compareGradesDesc'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader className="text-start">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle>{t('continueWithoutCourseWarningTitle')}</DialogTitle>
              <DialogDescription>{t('continueWithoutCourseWarningDesc')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => {
              onOpenChange(false);
              onContinue();
            }}
          >
            {t('calculateOnce')}
          </Button>
          <Button 
            className="flex-1 gap-2" 
            onClick={() => {
              onOpenChange(false);
              navigate('/app/settings');
            }}
          >
            <Zap className="w-4 h-4" />
            {t('upgradeNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
