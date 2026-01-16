import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Unlock, ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface PlanItem {
  id: string;
  topic_id: string | null;
  is_completed: boolean;
  prereq_topic_ids?: string[];
  topic?: {
    id: string;
    title: string;
  };
  course?: {
    id: string;
    title: string;
    color: string;
  };
}

interface PlanDay {
  id: string;
  date: string;
  items: PlanItem[];
}

interface NextUnlockCardProps {
  planDays: PlanDay[];
  className?: string;
}

/**
 * NextUnlockCard shows the immediate topics that will be unlocked
 * by completing today's prerequisite tasks
 */
export function NextUnlockCard({ planDays, className }: NextUnlockCardProps) {
  const { language, dir } = useLanguage();

  // Compute unlockable topics
  const { todaysKeyPrereqs, unlockedTopics } = useMemo(() => {
    // Get today's date string
    const today = new Date().toISOString().split('T')[0];
    
    // Find today's day
    const todayPlan = planDays.find(d => d.date === today);
    if (!todayPlan) return { todaysKeyPrereqs: [], unlockedTopics: [] };

    // Get all incomplete items for today
    const todaysIncomplete = todayPlan.items.filter(
      item => !item.is_completed && item.topic_id
    );

    // Build set of completed topic IDs across all days
    const completedTopicIds = new Set<string>();
    planDays.forEach(day => {
      day.items.forEach(item => {
        if (item.is_completed && item.topic_id) {
          completedTopicIds.add(item.topic_id);
        }
      });
    });

    // Collect all items from future days
    const futureItems: PlanItem[] = [];
    planDays.forEach(day => {
      if (day.date > today) {
        futureItems.push(...day.items.filter(i => i.topic_id));
      }
    });

    // Find topics that would be unlocked by completing today's tasks
    const unlockedByToday: Array<{
      topic: PlanItem;
      prereqs: PlanItem[];
    }> = [];

    // For each future item, check if it depends on any of today's items
    futureItems.forEach(futureItem => {
      const prereqIds = futureItem.prereq_topic_ids || [];
      if (prereqIds.length === 0) return;

      // Find which of today's items are prerequisites for this future item
      const relevantTodayPrereqs = todaysIncomplete.filter(
        todayItem => todayItem.topic_id && prereqIds.includes(todayItem.topic_id)
      );

      if (relevantTodayPrereqs.length > 0) {
        // Check if ALL prerequisites would be met after completing today's relevant items
        const wouldBeComplete = prereqIds.every(prereqId => {
          // Either already completed OR one of today's items
          return completedTopicIds.has(prereqId) || 
                 todaysIncomplete.some(ti => ti.topic_id === prereqId);
        });

        if (wouldBeComplete) {
          unlockedByToday.push({
            topic: futureItem,
            prereqs: relevantTodayPrereqs,
          });
        }
      }
    });

    // Get unique key prerequisites from today
    const keyPrereqIds = new Set<string>();
    unlockedByToday.forEach(({ prereqs }) => {
      prereqs.forEach(p => {
        if (p.topic_id) keyPrereqIds.add(p.topic_id);
      });
    });

    const keyPrereqs = todaysIncomplete.filter(
      item => item.topic_id && keyPrereqIds.has(item.topic_id)
    );

    // Deduplicate unlocked topics
    const seenTopicIds = new Set<string>();
    const uniqueUnlocked = unlockedByToday.filter(({ topic }) => {
      if (!topic.topic_id || seenTopicIds.has(topic.topic_id)) return false;
      seenTopicIds.add(topic.topic_id);
      return true;
    });

    return {
      todaysKeyPrereqs: keyPrereqs.slice(0, 3),
      unlockedTopics: uniqueUnlocked.slice(0, 4),
    };
  }, [planDays]);

  // Don't render if nothing to show
  if (unlockedTopics.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Unlock className="w-4 h-4 text-primary" />
          {language === "ar" ? "المواضيع القادمة" : "Next Unlock"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {language === "ar"
            ? `أكمل ${todaysKeyPrereqs.length} موضوع(ات) اليوم لفتح:`
            : `Complete ${todaysKeyPrereqs.length} topic(s) today to unlock:`}
        </p>

        {/* Key prerequisites for today */}
        {todaysKeyPrereqs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {language === "ar" ? "المتطلبات اليوم:" : "Today's Key Tasks:"}
            </p>
            <div className="flex flex-wrap gap-1">
              {todaysKeyPrereqs.map(prereq => (
                <Badge
                  key={prereq.id}
                  variant="outline"
                  className="text-xs"
                  style={{ 
                    borderColor: prereq.course?.color || '#6366f1',
                    backgroundColor: `${prereq.course?.color || '#6366f1'}10`,
                  }}
                >
                  {prereq.topic?.title?.slice(0, 20) || 'Topic'}
                  {(prereq.topic?.title?.length || 0) > 20 && '...'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className={cn(
            "w-5 h-5 text-primary",
            dir === "rtl" && "rotate-180"
          )} />
        </div>

        {/* Topics that will be unlocked */}
        <div className="space-y-2">
          {unlockedTopics.map(({ topic, prereqs }) => (
            <div
              key={topic.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-background border"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: topic.course?.color || '#6366f1' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {topic.topic?.title || 'Topic'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {topic.course?.title}
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 opacity-50 flex-shrink-0" />
            </div>
          ))}
        </div>

        {unlockedTopics.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {language === "ar"
              ? `${unlockedTopics.length} موضوع(ات) ستفتح`
              : `${unlockedTopics.length} topic(s) will be unlocked`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
