import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMastery } from "@/hooks/useMastery";
import { QuizModal } from "@/components/QuizModal";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  title: string;
  status: string;
  prerequisite_ids: string[] | null;
  difficulty_weight: number | null;
  exam_importance: number | null;
}

interface TopicMasteryDisplayProps {
  courseId: string;
  topics: Topic[];
}

/**
 * Displays mastery scores for all topics in a course
 * Shows weak prerequisites and provides study recommendations
 */
export function TopicMasteryDisplay({ courseId, topics }: TopicMasteryDisplayProps) {
  const { t, language, dir } = useLanguage();
  const { masteryData, isLoading, getMastery, refresh: refreshMastery } = useMastery(courseId);
  
  // State for quiz modal
  const [quizOpen, setQuizOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Calculate mastery statistics
  const stats = useMemo(() => {
    const masteredTopics = topics.filter(t => {
      const mastery = getMastery(t.id);
      return mastery && mastery.mastery_score >= 70;
    });

    const weakTopics = topics.filter(t => {
      const mastery = getMastery(t.id);
      return mastery && mastery.mastery_score < 50 && mastery.mastery_score > 0;
    });

    const unassessedTopics = topics.filter(t => {
      const mastery = getMastery(t.id);
      return !mastery || mastery.quiz_attempts_count === 0;
    });

    // Find weak prerequisites (prerequisites with low mastery)
    const weakPrerequisites: Topic[] = [];
    topics.forEach(topic => {
      const prereqIds = topic.prerequisite_ids || [];
      prereqIds.forEach(prereqId => {
        const prereq = topics.find(t => t.id === prereqId);
        if (prereq) {
          const mastery = getMastery(prereqId);
          if (!mastery || mastery.mastery_score < 50) {
            if (!weakPrerequisites.find(p => p.id === prereqId)) {
              weakPrerequisites.push(prereq);
            }
          }
        }
      });
    });

    // Calculate average mastery
    const assessedTopics = topics.filter(t => {
      const mastery = getMastery(t.id);
      return mastery && mastery.quiz_attempts_count > 0;
    });
    
    const avgMastery = assessedTopics.length > 0
      ? assessedTopics.reduce((sum, t) => sum + (getMastery(t.id)?.mastery_score || 0), 0) / assessedTopics.length
      : 0;

    return {
      mastered: masteredTopics.length,
      weak: weakTopics.length,
      unassessed: unassessedTopics.length,
      weakPrerequisites,
      avgMastery: Math.round(avgMastery),
      total: topics.length,
    };
  }, [topics, getMastery]);

  if (isLoading || topics.length === 0) {
    return null;
  }

  const getMasteryColor = (score: number | undefined): string => {
    if (!score || score === 0) return "bg-muted";
    if (score >= 70) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMasteryLabel = (score: number | undefined): string => {
    if (!score || score === 0) return language === "ar" ? "غير مقيم" : "Not assessed";
    if (score >= 70) return language === "ar" ? "متقن" : "Mastered";
    if (score >= 50) return language === "ar" ? "متوسط" : "Moderate";
    return language === "ar" ? "ضعيف" : "Weak";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          {language === "ar" ? "مستوى الإتقان" : "Mastery Level"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold text-primary">{stats.avgMastery}%</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "المعدل" : "Average"}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-500">{stats.mastered}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "متقن" : "Mastered"}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10">
            <div className="text-2xl font-bold text-red-500">{stats.weak}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "ضعيف" : "Weak"}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold text-muted-foreground">{stats.unassessed}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "غير مقيم" : "Unassessed"}
            </div>
          </div>
        </div>

        {/* Weak Prerequisites Warning */}
        {stats.weakPrerequisites.length > 0 && (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              {language === "ar" 
                ? `${stats.weakPrerequisites.length} متطلب(ات) مسبقة ضعيفة` 
                : `${stats.weakPrerequisites.length} Weak Prerequisite(s)`}
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.weakPrerequisites.slice(0, 5).map(prereq => (
                <Badge 
                  key={prereq.id} 
                  variant="outline" 
                  className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  {prereq.title.length > 20 ? prereq.title.slice(0, 20) + '...' : prereq.title}
                </Badge>
              ))}
              {stats.weakPrerequisites.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{stats.weakPrerequisites.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Topic Mastery List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {topics.slice(0, 10).map(topic => {
            const mastery = getMastery(topic.id);
            const score = mastery?.mastery_score || 0;
            const attempts = mastery?.quiz_attempts_count || 0;

            return (
              <div 
                key={topic.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      topic.status === 'done' && "line-through text-muted-foreground"
                    )}>
                      {topic.title}
                    </p>
                    {topic.status === 'done' && (
                      <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress 
                      value={score} 
                      className="h-1.5 flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-10 text-end">
                      {score}%
                    </span>
                  </div>
                </div>
                {/* Show "Assess" button for unassessed topics */}
                {attempts === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 flex-shrink-0"
                    onClick={() => {
                      setSelectedTopic(topic);
                      setQuizOpen(true);
                    }}
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    {t('assess')}
                  </Button>
                ) : (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs flex-shrink-0",
                      score >= 70 && "border-green-500/50 text-green-600",
                      score >= 50 && score < 70 && "border-yellow-500/50 text-yellow-600",
                      score > 0 && score < 50 && "border-red-500/50 text-red-600",
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {attempts}
                    </span>
                  </Badge>
                )}
              </div>
            );
          })}
          {topics.length > 10 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              {language === "ar" 
                ? `و ${topics.length - 10} موضوع(ات) أخرى...` 
                : `and ${topics.length - 10} more topic(s)...`}
            </p>
          )}
        </div>
      </CardContent>

      {/* Quiz Modal */}
      {selectedTopic && (
        <QuizModal
          open={quizOpen}
          onOpenChange={setQuizOpen}
          topicId={selectedTopic.id}
          topicTitle={selectedTopic.title}
          courseId={courseId}
          onQuizComplete={() => {
            refreshMastery();
            setQuizOpen(false);
          }}
        />
      )}
    </Card>
  );
}
