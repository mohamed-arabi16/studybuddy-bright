import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TopicMastery {
  topic_id: string;
  mastery_score: number;
  confidence: number;
  last_assessed_at: string | null;
  quiz_attempts_count: number;
  total_time_spent_sec: number;
}

export interface TopicWithMastery {
  id: string;
  title: string;
  status: string;
  mastery?: TopicMastery;
}

interface UseMasteryReturn {
  masteryData: Map<string, TopicMastery>;
  isLoading: boolean;
  error: string | null;
  getMastery: (topicId: string) => TopicMastery | undefined;
  refresh: () => Promise<void>;
}

export function useMastery(courseId?: string): UseMasteryReturn {
  const [masteryData, setMasteryData] = useState<Map<string, TopicMastery>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMastery = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMasteryData(new Map());
        return;
      }

      // Build query
      let query = supabase
        .from('topic_mastery')
        .select('topic_id, mastery_score, confidence, last_assessed_at, quiz_attempts_count, total_time_spent_sec')
        .eq('user_id', user.id);

      // If courseId provided, filter to topics in that course
      if (courseId) {
        const { data: topicIds } = await supabase
          .from('topics')
          .select('id')
          .eq('course_id', courseId);
        
        if (topicIds && topicIds.length > 0) {
          query = query.in('topic_id', topicIds.map(t => t.id));
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const masteryMap = new Map<string, TopicMastery>();
      (data || []).forEach((item) => {
        masteryMap.set(item.topic_id, item);
      });

      setMasteryData(masteryMap);
    } catch (err) {
      console.error('[useMastery] Error fetching mastery data:', err);
      setError('Failed to load mastery data');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchMastery();
  }, [fetchMastery]);

  const getMastery = useCallback((topicId: string): TopicMastery | undefined => {
    return masteryData.get(topicId);
  }, [masteryData]);

  return {
    masteryData,
    isLoading,
    error,
    getMastery,
    refresh: fetchMastery,
  };
}
