import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TopicYieldMetric {
  topic_id: string;
  total_exam_appearances: number;
  total_points_possible: number;
  normalized_yield_score: number;
  updated_at: string;
}

export interface PastExam {
  id: string;
  file_name: string;
  analysis_status: string;
  created_at: string;
}

export interface YieldSummary {
  exams_analyzed: number;
  topics_with_yield_data: number;
  high_yield_topics: number;
  weak_high_yield_count: number;
}

interface UseYieldMetricsReturn {
  yieldMetrics: TopicYieldMetric[];
  pastExams: PastExam[];
  summary: YieldSummary | null;
  isLoading: boolean;
  error: string | null;
  getYield: (topicId: string) => TopicYieldMetric | undefined;
  refresh: () => Promise<void>;
  analyzeExam: (fileId: string, title?: string) => Promise<{ success: boolean; error?: string }>;
}

export function useYieldMetrics(courseId?: string): UseYieldMetricsReturn {
  const [yieldMetrics, setYieldMetrics] = useState<TopicYieldMetric[]>([]);
  const [pastExams, setPastExams] = useState<PastExam[]>([]);
  const [summary, setSummary] = useState<YieldSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchYieldData = useCallback(async () => {
    if (!courseId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setYieldMetrics([]);
        setPastExams([]);
        return;
      }

      // Try direct DB query first (more reliable than edge function for simple reads)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: metrics } = await supabase
        .from('topic_yield_metrics')
        .select('topic_id, total_exam_appearances, total_points_possible, normalized_yield_score, updated_at')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('normalized_yield_score', { ascending: false });

      const { data: exams } = await supabase
        .from('past_exams')
        .select('id, file_name, analysis_status, created_at')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      setYieldMetrics(metrics || []);
      setPastExams(exams || []);
      
      const completedExams = (exams || []).filter(e => e.analysis_status === 'completed').length;
      const highYield = (metrics || []).filter(m => m.normalized_yield_score >= 70).length;
      
      setSummary({
        exams_analyzed: completedExams,
        topics_with_yield_data: (metrics || []).length,
        high_yield_topics: highYield,
        weak_high_yield_count: 0,
      });

    } catch (err) {
      console.error('[useYieldMetrics] Error fetching yield data:', err);
      setError('Failed to load yield data');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchYieldData();
  }, [fetchYieldData]);

  const getYield = useCallback((topicId: string): TopicYieldMetric | undefined => {
    return yieldMetrics.find(m => m.topic_id === topicId);
  }, [yieldMetrics]);

  const analyzeExam = useCallback(async (fileId: string, title?: string): Promise<{ success: boolean; error?: string }> => {
    if (!courseId) {
      return { success: false, error: 'No course ID' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await supabase.functions.invoke('analyze-past-exam', {
        body: {
          course_id: courseId,
          file_id: fileId,
          title,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      if (!response.data?.success) {
        return { success: false, error: response.data?.error || 'Analysis failed' };
      }

      // Refresh data after successful analysis
      await fetchYieldData();

      return { success: true };
    } catch (err) {
      console.error('[useYieldMetrics] Error analyzing exam:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [courseId, fetchYieldData]);

  return {
    yieldMetrics,
    pastExams,
    summary,
    isLoading,
    error,
    getYield,
    refresh: fetchYieldData,
    analyzeExam,
  };
}
