import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlanItemExplanationProps {
  explanationText?: string | null;
  reasonCodes?: string[];
  examProximityDays?: number | null;
  loadBalanceNote?: string | null;
  prereqTopicIds?: string[];
}

/**
 * "Why this date?" tooltip component for plan items
 * Shows deterministic explanation for why a topic was scheduled on a particular date
 */
export function PlanItemExplanation({
  explanationText,
  reasonCodes = [],
  examProximityDays,
  loadBalanceNote,
  prereqTopicIds = [],
}: PlanItemExplanationProps) {
  const { t, language } = useLanguage();

  // If no explanation data, don't render
  if (!explanationText && reasonCodes.length === 0) {
    return null;
  }

  // Map reason codes to display labels
  const getReasonLabel = (code: string): string => {
    const labels: Record<string, { en: string; ar: string }> = {
      prereq_unlocked: { en: "Prerequisites completed", ar: "تم إكمال المتطلبات" },
      exam_imminent: { en: "Exam very soon", ar: "الامتحان قريب جداً" },
      exam_approaching: { en: "Exam approaching", ar: "الامتحان يقترب" },
      high_importance: { en: "High importance", ar: "أهمية عالية" },
      high_difficulty: { en: "Challenging topic", ar: "موضوع صعب" },
      time_compressed: { en: "Time optimized", ar: "تحسين الوقت" },
      foundation_topic: { en: "Foundation topic", ar: "موضوع أساسي" },
    };
    return labels[code]?.[language] || code;
  };

  // Get urgency color based on exam proximity
  const getUrgencyColor = (days: number | null | undefined): string => {
    if (days === null || days === undefined) return "secondary";
    if (days <= 3) return "destructive";
    if (days <= 7) return "destructive";
    if (days <= 14) return "default";
    return "secondary";
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            className="p-1 rounded-full hover:bg-muted/50 transition-colors"
            aria-label={language === "ar" ? "لماذا هذا التاريخ؟" : "Why this date?"}
          >
            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[280px] p-3"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <div className="space-y-2">
            {/* Main explanation text */}
            {explanationText && (
              <p className="text-sm">{explanationText}</p>
            )}

            {/* Reason code badges */}
            {reasonCodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reasonCodes.slice(0, 3).map((code) => (
                  <Badge 
                    key={code} 
                    variant="outline" 
                    className="text-xs"
                  >
                    {getReasonLabel(code)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Exam proximity indicator */}
            {examProximityDays !== null && examProximityDays !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                <Badge variant={getUrgencyColor(examProximityDays)}>
                  {language === "ar" 
                    ? `${examProximityDays} يوم للامتحان`
                    : `${examProximityDays} day${examProximityDays !== 1 ? 's' : ''} to exam`}
                </Badge>
              </div>
            )}

            {/* Load balance note */}
            {loadBalanceNote && (
              <p className="text-xs text-muted-foreground italic">
                {loadBalanceNote}
              </p>
            )}

            {/* Prerequisites count */}
            {prereqTopicIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? `بعد ${prereqTopicIds.length} متطلب(ات) سابقة`
                  : `After ${prereqTopicIds.length} prerequisite${prereqTopicIds.length > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
