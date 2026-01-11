import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlanWarningBanner } from "@/components/PlanWarningBanner";
import { generateAllocation } from "@/lib/allocationEngine";
import { toast } from "sonner";
import { Calendar, RefreshCw, Sparkles, Brain, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlanResult {
  success: boolean;
  plan_days: number;
  plan_items: number;
  warnings: string[];
  overload_days: string[];
  coverage_ratio?: number;
  total_required_hours?: number;
  total_available_hours?: number;
  is_overloaded?: boolean;
  topics_scheduled?: number;
  topics_provided?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AllocationView({ course }: { course: any }) {
  const [allocations, setAllocations] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [hasTopics, setHasTopics] = useState(false);
  const [lastPlanResult, setLastPlanResult] = useState<PlanResult | null>(null);
  const { t, dir } = useLanguage();

  const fetchAllocations = async () => {
    const { data } = await supabase
      .from("allocations")
      .select("*")
      .eq("course_id", course.id)
      .order("date", { ascending: true });
    setAllocations(data || []);
  };

  const checkTopics = async () => {
    const { count } = await supabase
      .from("topics")
      .select("*", { count: 'exact', head: true })
      .eq("course_id", course.id);
    setHasTopics((count || 0) > 0);
  };

  useEffect(() => {
    fetchAllocations();
    checkTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  const handleGenerate = async () => {
    if (!course.exam_date) {
        toast.error(t('setExamDateFirst'));
        return;
    }
    setLoading(true);
    try {
        // 1. Fetch topics
        const { data: topics, error: tError } = await supabase
            .from("topics")
            .select("id, difficulty_weight, exam_importance")
            .eq("course_id", course.id);

        if (tError) throw tError;
        if (!topics || topics.length === 0) {
            toast.error(t('noTopicsFound'));
            return;
        }

        // 2. Generate plan
        const plan = generateAllocation(topics as any[], course.exam_date); // eslint-disable-line @typescript-eslint/no-explicit-any

        // 3. Save to DB (Delete old first)
        const { error: dError } = await supabase
            .from("allocations")
            .delete()
            .eq("course_id", course.id);
        if (dError) throw dError;

        if (plan.length > 0) {
            const toInsert = plan.map(p => ({
                course_id: course.id,
                date: p.date,
                topics_json: p.topics
            }));

            const { error: iError } = await supabase
                .from("allocations")
                .insert(toInsert);
            if (iError) throw iError;
        }

        toast.success(t('scheduleGenerated'));
        setLastPlanResult(null);
        fetchAllocations();

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        toast.error(`${t('planError')}: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };

  const handleSmartGenerate = async () => {
    if (!course.exam_date) {
      toast.error(t('setExamDateFirst'));
      return;
    }

    setSmartLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('generate-smart-plan', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        if (response.error.message?.includes('402')) {
          toast.error(t('aiCreditsExhausted'));
          return;
        }
        if (response.error.message?.includes('429')) {
          toast.error(t('rateLimitExceeded'));
          return;
        }
        throw new Error(response.error.message);
      }

      const data = response.data as PlanResult;
      setLastPlanResult(data);
      
      // Improved feedback based on actual plan creation
      if (data.warnings && data.warnings.length > 0) {
        // Check if plan was actually created
        if (data.plan_items > 0) {
          toast.warning(`${t('scheduleWarnings')} (${data.warnings.length})`, {
            description: `${t('smartPlanCreated')}: ${data.plan_items} ${t('topicsScheduled')}`,
            duration: 6000,
          });
        } else {
          toast.error(t('planNotCreated'), {
            description: data.warnings[0] || t('smartPlanFailed'),
          });
        }
      } else {
        toast.success(`${t('smartPlanCreated')}: ${data.plan_days} ${t('daysStudySessions')}`);
      }

      // Show topics coverage info
      if (data.topics_scheduled !== undefined && data.topics_provided !== undefined) {
        if (data.topics_scheduled < data.topics_provided) {
          toast.info(`${t('topicsCoverage')}: ${data.topics_scheduled}/${data.topics_provided}`);
        }
      }

      fetchAllocations();
      
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error("Smart plan error:", error);
      toast.error(error.message || t('smartPlanFailed'));
    } finally {
      setSmartLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!window.confirm(t('confirmDeletePlan'))) return;
    
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("allocations")
        .delete()
        .eq("course_id", course.id);
      
      if (error) throw error;
      
      toast.success(t('planDeleted'));
      setAllocations([]);
      setLastPlanResult(null);
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(`${t('deletePlanFailed')}: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Warning Banner for Overloaded Plans */}
      {lastPlanResult && (
        <PlanWarningBanner
          warnings={lastPlanResult.warnings || []}
          coverageRatio={lastPlanResult.coverage_ratio}
          totalRequiredHours={lastPlanResult.total_required_hours}
          totalAvailableHours={lastPlanResult.total_available_hours}
          isOverloaded={lastPlanResult.is_overloaded}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('studySchedule')}
          </CardTitle>
          <CardDescription>
            {t('generateScheduleDesc')} {course.exam_date ? format(new Date(course.exam_date), "PPP") : "..."}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Basic allocation button */}
            <Button 
              variant="outline"
              onClick={handleGenerate} 
              disabled={loading || smartLoading || !hasTopics || !course.exam_date}
            >
              {loading ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <Calendar className="me-2 h-4 w-4" />}
              {t('basicSchedule')}
            </Button>

            {/* AI Smart Schedule button - Available to ALL users */}
            <Button 
              onClick={handleSmartGenerate} 
              disabled={loading || smartLoading || !hasTopics || !course.exam_date}
              className="gap-2"
            >
              {smartLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              <Sparkles className="h-4 w-4" />
              {t('aiSmartSchedule')}
            </Button>
          </div>

          {!hasTopics && <p className="text-sm text-destructive">{t('addTopicsFirst')}</p>}
          {!course.exam_date && <p className="text-sm text-destructive">{t('setExamDate')}</p>}
        </CardContent>
      </Card>

      {allocations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{t('yourPlan')}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeletePlan}
              disabled={deleteLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleteLoading ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="me-2 h-4 w-4" />
              )}
              {t('deletePlan')}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allocations.map((day) => (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    {format(new Date(day.date), "EEE, MMM d")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(day.topics_json) ? day.topics_json.length : 0} {t('topicsScheduled')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
