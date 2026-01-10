import { AlertTriangle, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanWarningBannerProps {
  warnings: string[];
  coverageRatio?: number;
  totalRequiredHours?: number;
  totalAvailableHours?: number;
  isOverloaded?: boolean;
}

export function PlanWarningBanner({
  warnings,
  coverageRatio,
  totalRequiredHours,
  totalAvailableHours,
  isOverloaded,
}: PlanWarningBannerProps) {
  const { t, dir } = useLanguage();
  if (!isOverloaded && warnings.length === 0) return null;

  const coveragePercent = coverageRatio ? Math.round(coverageRatio * 100) : 100;
  const isSevere = coveragePercent < 50;

  return (
    <Alert variant={isSevere ? 'destructive' : 'default'} className="mb-4" dir={dir}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {isSevere ? t('severeTimeConstraint') : t('timeConstraintWarning')}
      </AlertTitle>
      <AlertDescription className="space-y-2 mt-2">
        {isOverloaded && totalRequiredHours && totalAvailableHours && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span>
              {t('youNeedHours')
                .replace('{required}', totalRequiredHours.toFixed(1))
                .replace('{available}', totalAvailableHours.toFixed(1))}
            </span>
          </div>
        )}
        
        {coverageRatio && (
          <div className="flex items-center gap-2 text-sm">
            <Info className="w-4 h-4" />
            <span>
              {t('coverageRatio').replace('{percent}', coveragePercent.toString())}
              {coveragePercent < 100 && t('studyHoursCompressed')}
            </span>
          </div>
        )}

        {warnings.length > 0 && (
          <ul className="list-disc list-inside text-sm space-y-1 mt-2">
            {warnings.slice(0, 5).map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}

        {isSevere && (
          <p className="text-sm mt-2 font-medium">
            {t('considerSuggestions')}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
