import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Calendar, Clock, CheckCircle2, 
  ChevronDown, ChevronUp, Loader2, Sparkles, BookOpen, ArrowRight, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePlanGeneration } from '@/hooks/usePlanGeneration';
import { useCredits } from '@/hooks/useCredits';
import { useToast } from '@/hooks/use-toast';
import { RescheduleCard } from '@/components/RescheduleCard';
import { PlanSummaryCard } from '@/components/PlanSummaryCard';
import { PlanWarningBanner } from '@/components/PlanWarningBanner';
import { PlanItemExplanation } from '@/components/PlanItemExplanation';
import { NextUnlockCard } from '@/components/NextUnlockCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

export default function Plan() {
  const { 
    planDays, 
    courseInfo,
    missedDays,
    totalMissedItems,
    planMetrics,
    isLoading, 
    isGenerating, 
    error,
    generatePlan,
    recreatePlan,
    toggleItemCompletion 
  } = usePlanGeneration();
  const { toast } = useToast();
  const { refresh: refreshCredits } = useCredits();
  const { t, dir, language } = useLanguage();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [hasCoursesWithTopics, setHasCoursesWithTopics] = useState<boolean | null>(null);
  const dateLocale = language === 'ar' ? ar : enUS;
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // Check if user has courses with topics for contextual guidance
  useEffect(() => {
    const checkCourses = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: courses } = await supabase
          .from('courses')
          .select('id, topics(id)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .not('exam_date', 'is', null);

        // Check if any course has topics
        const hasTopics = courses?.some(c => {
          const topics = c.topics;
          return Array.isArray(topics) && topics.length > 0;
        }) || false;
        setHasCoursesWithTopics(hasTopics);
      } catch {
        // Silently fail
      }
    };
    checkCourses();
  }, []);

  const handleGenerate = async () => {
    try {
      const result = await generatePlan();
      await refreshCredits(); // Refresh credits after plan generation
      toast({
        title: t('planCreated'),
        description: t('planCreatedDesc').replace('{days}', String(result.plan_days)).replace('{items}', String(result.plan_items)),
      });
    } catch {
      toast({
        title: t('planFailed'),
        description: error || t('tryAgain'),
        variant: 'destructive',
      });
    }
  };

  const handleReplan = async () => {
    try {
      const result = await recreatePlan();
      await refreshCredits(); // Refresh credits after plan regeneration
      toast({
        title: t('weekReplanned'),
        description: t('missedItemsDistributed').replace('{count}', String(result.plan_items || 0)),
      });
    } catch {
      toast({
        title: t('replanFailed'),
        description: error || t('tryAgain'),
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (itemId: string, checked: boolean) => {
    try {
      await toggleItemCompletion(itemId, checked);
    } catch {
      toast({
        title: t('updateFailed'),
        description: t('tryAgain'),
        variant: 'destructive',
      });
    }
  };

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t('today');
    if (isTomorrow(date)) return t('tomorrow');
    return format(date, 'EEEE', { locale: dateLocale });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Enhanced generating state with progress feedback
  // Uses motion-safe variants to respect user's reduced motion preference
  const GeneratingOverlay = () => (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-8 flex flex-col items-center justify-center text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 motion-safe:animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary motion-safe:animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {t('creatingSmartPlan')}
        </h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {language === 'ar' 
            ? 'نقوم بتحليل موادك وتوزيع المواضيع بذكاء حسب تواريخ الامتحانات وصعوبة كل موضوع.'
            : 'Analyzing your courses and intelligently distributing topics based on exam dates and difficulty.'}
        </p>
        <div className="flex gap-1 mt-4 motion-reduce:hidden">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
        {/* Static indicator for reduced motion preference */}
        <div className="mt-4 motion-safe:hidden">
          <Loader2 className="w-5 h-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 w-full" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('studyPlan')}</h1>
          <p className="text-muted-foreground">
            {t('customScheduleDesc')}
          </p>
        </div>
        <Button 
          onClick={planDays.length > 0 ? handleReplan : handleGenerate} 
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {planDays.length > 0 ? t('recreatePlan') : t('createPlan')}
        </Button>
      </div>

      {/* Show generating overlay when generating */}
      {isGenerating && <GeneratingOverlay />}

      {/* Plan Summary Card - shows metrics when plan exists */}
      {planMetrics && planDays.length > 0 && (
        <PlanSummaryCard 
          metrics={planMetrics} 
          totalPlanDays={planDays.length} 
        />
      )}

      {/* Plan Warning Banner - shows when there are warnings or priority mode */}
      {planMetrics && planMetrics.warnings.length > 0 && (
        <PlanWarningBanner
          warnings={planMetrics.warnings}
          coverageRatio={planMetrics.coverageRatio}
          totalRequiredHours={planMetrics.totalRequiredHours}
          totalAvailableHours={planMetrics.totalAvailableHours}
          isOverloaded={planMetrics.workloadIntensity === 'overloaded'}
          isPriorityMode={planMetrics.isPriorityMode}
          topicsScheduled={planMetrics.topicsScheduled}
          topicsProvided={planMetrics.topicsTotal}
        />
      )}

      {/* Reschedule Card - shows when there are missed items */}
      {totalMissedItems > 0 && planDays.length > 0 && (
        <RescheduleCard
          missedDays={missedDays}
          totalMissedItems={totalMissedItems}
          onReplan={handleReplan}
          isReplanning={isGenerating}
        />
      )}

      {/* Course Overview */}
      {courseInfo.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courseInfo.map(course => (
            <Card key={course.id} className="bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4">
                <h3 className="font-semibold truncate">{course.title}</h3>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t('daysUntilExam')}:</span>
                    <Badge variant={Number(course.days_left) <= 7 ? 'destructive' : 'secondary'}>
                      {course.days_left}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('dailyHours')}:</span>
                    <span className="font-medium">{course.daily_hours} {t('hours')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('remainingTopics')}:</span>
                    <span className="font-medium">{course.remaining_topics}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Next Unlock Card - shows topics that will be unlocked by completing today's prerequisites */}
      {planDays.length > 0 && (
        <NextUnlockCard planDays={planDays} />
      )}

      {/* Empty State with Contextual Guidance */}
      {planDays.length === 0 && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('noPlanYet')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('noPlanDesc')}
            </p>
            
            {/* Contextual guidance based on user state */}
            {hasCoursesWithTopics === false ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium">{t('hintGetStarted')}</span>
                  </div>
                  <p className="text-xs mb-3">
                    {t('hintAddTopicsDesc')}
                  </p>
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to="/app/courses">
                      {t('hintNavigateToCoursesBtn')}
                      <ArrowIcon className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleGenerate} disabled={isGenerating}>
                <Sparkles className="w-4 h-4 me-2" />
                {t('createPlan')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Days */}
      <div className="space-y-3">
        {planDays.map((day, index) => {
          const isExpanded = expandedDays.has(day.id) || index < 3;
          const completedCount = day.items.filter(i => i.is_completed).length;
          const totalCount = day.items.length;
          const allComplete = completedCount === totalCount && totalCount > 0;

          return (
            <Collapsible
              key={day.id}
              open={isExpanded}
              onOpenChange={() => toggleDay(day.id)}
            >
              <Card className={`transition-colors ${allComplete ? 'bg-green-500/5 border-green-500/20' : ''}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center
                          ${isToday(new Date(day.date)) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                          }
                        `}>
                          <span className="text-sm font-bold">
                            {format(new Date(day.date), 'd')}
                          </span>
                        </div>
                        <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            {getDayLabel(day.date)}
                            {day.is_day_off && (
                              <Badge variant="secondary">{t('restDay')}</Badge>
                            )}
                            {allComplete && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(day.date), 'd MMMM yyyy', { locale: dateLocale })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{day.total_hours} {t('hours')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {completedCount}/{totalCount} {t('completed')}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {day.is_day_off ? (
                      <p className="text-muted-foreground text-center py-4">
                        {t('enjoyRestDay')}
                      </p>
                    ) : day.items.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        {t('noScheduledTopics')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {day.items.map(item => (
                          <div
                            key={item.id}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg border transition-colors
                              ${item.is_completed 
                                ? 'bg-muted/50 border-muted' 
                                : 'bg-background border-border hover:border-primary/30'
                              }
                            `}
                          >
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={(checked) => 
                                handleToggle(item.id, checked as boolean)
                              }
                            />
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: item.course?.color || '#6366f1' }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className={`font-medium truncate ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                  {item.topic?.title || t('generalStudy')}
                                </p>
                                {/* "Why this date?" tooltip */}
                                <PlanItemExplanation
                                  explanationText={item.explanation_text}
                                  reasonCodes={item.reason_codes}
                                  examProximityDays={item.exam_proximity_days}
                                  loadBalanceNote={item.load_balance_note}
                                  prereqTopicIds={item.prereq_topic_ids}
                                  yieldWeight={item.yield_weight}
                                  masterySnapshot={item.mastery_snapshot}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.course?.title}
                              </p>
                            </div>
                            <Badge variant="outline" className="flex-shrink-0">
                              {item.hours} {t('hours')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
