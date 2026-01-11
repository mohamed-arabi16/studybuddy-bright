import { AlertTriangle, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanWarningBannerProps {
  warnings: string[];
  coverageRatio?: number;
  totalRequiredHours?: number;
  totalAvailableHours?: number;
  isOverloaded?: boolean;
  isPriorityMode?: boolean;
  topicsScheduled?: number;
  topicsProvided?: number;
}

export function PlanWarningBanner({
  warnings,
  coverageRatio,
  totalRequiredHours,
  totalAvailableHours,
  isOverloaded,
  isPriorityMode,
  topicsScheduled,
  topicsProvided,
}: PlanWarningBannerProps) {
  const { t, dir } = useLanguage();
  
  // Show banner if priority mode, overloaded, or has warnings
  if (!isPriorityMode && !isOverloaded && warnings.length === 0) return null;

  const coveragePercent = coverageRatio ? Math.round(coverageRatio * 100) : 100;
  const isSevere = coveragePercent < 50;

  return (
    <div className="space-y-3" dir={dir}>
      {/* Priority Mode Banner */}
      {isPriorityMode && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            {t('priorityModeActive')}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p className="text-sm">{t('priorityModeDesc')}</p>
            {topicsScheduled !== undefined && topicsProvided !== undefined && (
              <p className="text-sm mt-1 font-medium">
                {topicsScheduled}/{topicsProvided} {t('priorityTopicsScheduled')}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Time Constraint Banner */}
      {(isOverloaded || warnings.length > 0) && !isPriorityMode && (
        <Alert variant={isSevere ? 'destructive' : 'default'}>
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
            
            {coverageRatio && coverageRatio < 1 && (
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
      )}
    </div>
  );
}
