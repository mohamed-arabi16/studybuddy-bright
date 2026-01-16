import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StudyPlanDay {
  id: string;
  date: string;
  total_hours: number;
  is_day_off: boolean;
  items: StudyPlanItem[];
}

interface StudyPlanItem {
  id: string;
  course_id: string;
  topic_id: string | null;
  hours: number;
  order_index: number;
  is_completed: boolean;
  // Explanation fields for "Why this date?" tooltip
  reason_codes?: string[];
  explanation_text?: string;
  prereq_topic_ids?: string[];
  exam_proximity_days?: number;
  load_balance_note?: string;
  // New mastery/yield fields
  yield_weight?: number;
  mastery_snapshot?: number;
  scheduling_factors?: Record<string, unknown>;
  course?: {
    id: string;
    title: string;
    color: string;
  };
  topic?: {
    id: string;
    title: string;
    estimated_hours: number;
  };
}

interface CourseInfo {
  id: string;
  title: string;
  days_left: number;
  urgency: string;
  daily_hours: string;
  remaining_topics: number;
  topics_scheduled?: number;
}

interface MissedDay {
  date: string;
  missedItems: number;
  totalItems: number;
}

interface PlanMetrics {
  isPriorityMode: boolean;
  coverageRatio: number;
  totalRequiredHours: number;
  totalAvailableHours: number;
  topicsScheduled: number;
  topicsTotal: number;
  workloadIntensity: 'light' | 'moderate' | 'heavy' | 'overloaded';
  avgHoursPerStudyDay: number;
  studyDaysCreated: number;
  estimatedCompletionDate: string | null;
  suggestions: string[];
  urgentCoursesCount: number;
  warnings: string[];
}

export function usePlanGeneration() {
  const [planDays, setPlanDays] = useState<StudyPlanDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo[]>([]);
  const [missedDays, setMissedDays] = useState<MissedDay[]>([]);
  const [totalMissedItems, setTotalMissedItems] = useState(0);
  const [planMetrics, setPlanMetrics] = useState<PlanMetrics | null>(null);

  const fetchPlan = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch plan days with items, courses, and topics in a single query using Supabase joins
      // Include explanation fields for "Why this date?" tooltips
      const { data: days, error: daysError } = await supabase
        .from('study_plan_days')
        .select(`
          id,
          date,
          total_hours,
          is_day_off,
          study_plan_items (
            id,
            course_id,
            topic_id,
            hours,
            order_index,
            is_completed,
            reason_codes,
            explanation_text,
            prereq_topic_ids,
            exam_proximity_days,
            load_balance_note,
            yield_weight,
            mastery_snapshot,
            scheduling_factors,
            courses (
              id,
              title,
              color
            ),
            topics (
              id,
              title,
              estimated_hours
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (daysError) throw daysError;

      if (!days || days.length === 0) {
        setPlanDays([]);
        setIsLoading(false);
        return;
      }

      // Transform the nested data structure
      // Note: Supabase returns joined data with plural names (courses, topics) but as single objects
      // for many-to-one relationships, not arrays
      const daysWithItems: StudyPlanDay[] = days.map(day => {
        const items = (day.study_plan_items || [])
          .sort((a, b) => a.order_index - b.order_index)
          .map(item => ({
            id: item.id,
            course_id: item.course_id,
            topic_id: item.topic_id,
            hours: item.hours,
            order_index: item.order_index,
            is_completed: item.is_completed,
            // Explanation fields for "Why this date?" tooltip
            reason_codes: item.reason_codes || [],
            explanation_text: item.explanation_text || null,
            prereq_topic_ids: item.prereq_topic_ids || [],
            exam_proximity_days: item.exam_proximity_days,
            load_balance_note: item.load_balance_note || null,
            // Mastery/yield fields
            yield_weight: item.yield_weight,
            mastery_snapshot: item.mastery_snapshot,
            scheduling_factors: item.scheduling_factors || undefined,
            // Supabase returns the joined course/topic as singular objects despite plural table names
            course: item.courses || undefined,
            topic: item.topics || undefined,
          }));

        return {
          id: day.id,
          date: day.date,
          total_hours: day.total_hours,
          is_day_off: day.is_day_off,
          items,
        };
      });

      setPlanDays(daysWithItems);

    } catch (err) {
      console.error('Fetch plan error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch plan');
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze missed days for rescheduling suggestions
  const analyzeMissedDays = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);

      // Fetch past days with their items in a single query using Supabase joins
      const { data: pastDays } = await supabase
        .from('study_plan_days')
        .select(`
          id,
          date,
          is_day_off,
          study_plan_items (
            id,
            is_completed
          )
        `)
        .eq('user_id', user.id)
        .gte('date', weekAgo.toISOString().split('T')[0])
        .lt('date', today.toISOString().split('T')[0])
        .eq('is_day_off', false);

      if (!pastDays || pastDays.length === 0) {
        setMissedDays([]);
        setTotalMissedItems(0);
        return;
      }

      const missed: MissedDay[] = [];
      let totalMissed = 0;

      for (const day of pastDays) {
        const items = day.study_plan_items || [];
        if (items.length > 0) {
          const incompleteCount = items.filter(i => !i.is_completed).length;
          if (incompleteCount > 0) {
            missed.push({
              date: day.date,
              missedItems: incompleteCount,
              totalItems: items.length,
            });
            totalMissed += incompleteCount;
          }
        }
      }

      setMissedDays(missed);
      setTotalMissedItems(totalMissed);
    } catch (err) {
      console.error('Analyze missed days error:', err);
    }
  };

  // Generate unified plan with cross-course mixing and dependency handling
  const generatePlan = async (mode: 'full' | 'recreate' = 'full') => {
    try {
      setIsGenerating(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-unified-plan', {
        body: { 
          mode,
          excludeCompleted: true,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        // Extract detailed error info
        const errorData = response.error;
        const errorCode = errorData.code || 'UNKNOWN';
        const errorMsg = errorData.message || 'Failed to generate plan';
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      if (response.data.courses_included) {
        setCourseInfo(response.data.courses_included);
      }

      // Capture plan metrics for UI display
      if (response.data) {
        setPlanMetrics({
          isPriorityMode: response.data.is_priority_mode || false,
          coverageRatio: response.data.coverage_ratio || 1,
          totalRequiredHours: response.data.total_required_hours || 0,
          totalAvailableHours: response.data.total_available_hours || 0,
          topicsScheduled: response.data.topics_scheduled || 0,
          topicsTotal: response.data.topics_total || 0,
          workloadIntensity: response.data.workload_intensity || 'moderate',
          avgHoursPerStudyDay: response.data.avg_hours_per_study_day || 0,
          studyDaysCreated: response.data.study_days_created || 0,
          estimatedCompletionDate: response.data.estimated_completion_date || null,
          suggestions: response.data.suggestions || [],
          urgentCoursesCount: response.data.urgent_courses_count || 0,
          warnings: response.data.warnings || [],
        });
      }

      // Refresh the plan and missed days analysis
      await Promise.all([fetchPlan(), analyzeMissedDays()]);

      return response.data;

    } catch (err) {
      console.error('Generate plan error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Recreate plan - excludes completed topics and respects dependencies
  const recreatePlan = async () => {
    return generatePlan('recreate');
  };

  // Create new plan from scratch
  const createNewPlan = async () => {
    return generatePlan('full');
  };

  const toggleItemCompletion = async (itemId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('study_plan_items')
        .update({ 
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setPlanDays(prev => prev.map(day => ({
        ...day,
        items: day.items.map(item => 
          item.id === itemId ? { ...item, is_completed: isCompleted } : item
        ),
      })));

      // Also update topic status if topic_id exists
      const item = planDays.flatMap(d => d.items).find(i => i.id === itemId);
      if (item?.topic_id) {
        await supabase
          .from('topics')
          .update({ 
            status: isCompleted ? 'done' : 'in_progress',
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
          })
          .eq('id', item.topic_id);
      }

    } catch (err) {
      console.error('Toggle completion error:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchPlan();
    analyzeMissedDays();
  }, []);

  return {
    planDays,
    courseInfo,
    missedDays,
    totalMissedItems,
    planMetrics,
    isLoading,
    isGenerating,
    error,
    generatePlan: createNewPlan,
    recreatePlan,
    replanWeek: recreatePlan, // Alias for backwards compatibility
    refreshPlan: fetchPlan,
    toggleItemCompletion,
  };
}
