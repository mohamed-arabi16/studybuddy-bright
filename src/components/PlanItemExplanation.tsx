import { Info, Flame, Brain, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
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
  yieldWeight?: number | null;
  masterySnapshot?: number | null;
}

/**
 * "Why this date?" tooltip component for plan items
 * Shows deterministic explanation for why a topic was scheduled on a particular date
 * Now includes yield and mastery information
 */
export function PlanItemExplanation({
  explanationText,
  reasonCodes = [],
  examProximityDays,
  loadBalanceNote,
  prereqTopicIds = [],
  yieldWeight,
  masterySnapshot,
}: PlanItemExplanationProps) {
  const { t, language } = useLanguage();

  // If no explanation data, don't render
  if (!explanationText && reasonCodes.length === 0) {
    return null;
  }

  // Map reason codes to display labels and icons
  const getReasonLabel = (code: string): { label: string; icon?: React.ReactNode; className?: string } => {
    const labels: Record<string, { en: string; ar: string; icon?: React.ReactNode; className?: string }> = {
      prereq_unlocked: { en: "Prerequisites completed", ar: "تم إكمال المتطلبات" },
      exam_imminent: { en: "Exam very soon", ar: "الامتحان قريب جداً", className: "border-red-500/50 text-red-600" },
      exam_approaching: { en: "Exam approaching", ar: "الامتحان يقترب", className: "border-orange-500/50 text-orange-600" },
      high_importance: { en: "High importance", ar: "أهمية عالية" },
      high_difficulty: { en: "Challenging topic", ar: "موضوع صعب" },
      time_compressed: { en: "Time optimized", ar: "تحسين الوقت" },
      foundation_topic: { en: "Foundation topic", ar: "موضوع أساسي" },
      high_yield: { en: "High yield", ar: "عالي العائد", icon: <Flame className="w-3 h-3 text-orange-500" />, className: "border-orange-500/50 text-orange-600" },
      low_mastery: { en: "Needs review", ar: "يحتاج مراجعة", icon: <Brain className="w-3 h-3 text-purple-500" />, className: "border-purple-500/50 text-purple-600" },
      mastery_boost: { en: "Mastery boost", ar: "تعزيز الإتقان", icon: <TrendingUp className="w-3 h-3 text-green-500" />, className: "border-green-500/50 text-green-600" },
    };
    const info = labels[code] || { en: code, ar: code };
    return { 
      label: info[language as 'en' | 'ar'] || code, 
      icon: info.icon,
      className: info.className 
    };
  };

  // Get urgency color based on exam proximity
  const getUrgencyColor = (days: number | null | undefined): "default" | "destructive" | "outline" | "secondary" => {
    if (days === null || days === undefined) return "secondary";
    if (days <= 3) return "destructive";
    if (days <= 7) return "destructive";
    if (days <= 14) return "default";
    return "secondary";
  };

  return (
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
                {reasonCodes.slice(0, 4).map((code) => {
                  const { label, icon, className } = getReasonLabel(code);
                  return (
                    <Badge 
                      key={code} 
                      variant="outline" 
                      className={`text-xs ${className || ''}`}
                    >
                      {icon}
                      {label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Yield indicator */}
            {yieldWeight !== null && yieldWeight !== undefined && yieldWeight > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className={yieldWeight >= 0.5 ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                  {language === "ar" 
                    ? `عائد: ${Math.round(yieldWeight * 100)}%`
                    : `Yield: ${Math.round(yieldWeight * 100)}%`}
                </span>
              </div>
            )}

            {/* Mastery indicator */}
            {masterySnapshot !== null && masterySnapshot !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                <Brain className="w-3 h-3 text-purple-500" />
                <span className={masterySnapshot < 50 ? "text-purple-600 font-medium" : "text-muted-foreground"}>
                  {language === "ar" 
                    ? `إتقان: ${masterySnapshot}%`
                    : `Mastery: ${masterySnapshot}%`}
                </span>
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
  );
}
