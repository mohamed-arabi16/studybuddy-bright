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

export function usePlanGeneration() {
  const [planDays, setPlanDays] = useState<StudyPlanDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo[]>([]);
  const [missedDays, setMissedDays] = useState<MissedDay[]>([]);
  const [totalMissedItems, setTotalMissedItems] = useState(0);

  const fetchPlan = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch plan days with items
      const { data: days, error: daysError } = await supabase
        .from('study_plan_days')
        .select(`
          id,
          date,
          total_hours,
          is_day_off
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

      // Fetch items for each day
      const daysWithItems: StudyPlanDay[] = [];
      
      for (const day of days) {
        const { data: items, error: itemsError } = await supabase
          .from('study_plan_items')
          .select(`
            id,
            course_id,
            topic_id,
            hours,
            order_index,
            is_completed
          `)
          .eq('plan_day_id', day.id)
          .order('order_index', { ascending: true });

        if (itemsError) continue;

        // Fetch course and topic info for each item
        const enrichedItems: StudyPlanItem[] = [];
        
        for (const item of items || []) {
          const { data: course } = await supabase
            .from('courses')
            .select('id, title, color')
            .eq('id', item.course_id)
            .single();

          let topic = null;
          if (item.topic_id) {
            const { data: topicData } = await supabase
              .from('topics')
              .select('id, title, estimated_hours')
              .eq('id', item.topic_id)
              .single();
            topic = topicData;
          }

          enrichedItems.push({
            ...item,
            course: course || undefined,
            topic: topic || undefined,
          });
        }

        daysWithItems.push({
          ...day,
          items: enrichedItems,
        });
      }

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

      // Fetch past days with their items
      const { data: pastDays } = await supabase
        .from('study_plan_days')
        .select('id, date, is_day_off')
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
        const { data: items } = await supabase
          .from('study_plan_items')
          .select('id, is_completed')
          .eq('plan_day_id', day.id);

        if (items && items.length > 0) {
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
