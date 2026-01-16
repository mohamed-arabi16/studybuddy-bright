import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const course_id = url.searchParams.get("course_id");

    if (!course_id) {
      return new Response(
        JSON.stringify({ error: "course_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= P0: AUTH GUARD =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    // ============= Verify ownership of course =============
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, user_id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (course.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Fetch yield metrics with topic info =============
    const { data: yieldMetrics, error: metricsError } = await supabase
      .from("topic_yield_metrics")
      .select(`
        topic_id,
        frequency_count,
        normalized_yield,
        total_weight,
        exam_count,
        updated_at,
        topics (
          id,
          title,
          status,
          exam_importance,
          difficulty_weight
        )
      `)
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .order("normalized_yield", { ascending: false });

    if (metricsError) {
      console.error("[get-yield-summary] Error fetching metrics:", metricsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch yield metrics" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Fetch past exams for this course =============
    const { data: pastExams, error: examsError } = await supabase
      .from("past_exams")
      .select("id, title, exam_date, analysis_status, created_at")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .order("created_at", { ascending: false });

    if (examsError) {
      console.error("[get-yield-summary] Error fetching exams:", examsError);
    }

    // ============= Fetch mastery data for context =============
    const topicIds = (yieldMetrics || []).map(m => m.topic_id);
    
    let masteryData: Array<{ topic_id: string; mastery_score: number }> = [];
    if (topicIds.length > 0) {
      const { data: mastery } = await supabase
        .from("topic_mastery")
        .select("topic_id, mastery_score")
        .eq("user_id", user.id)
        .in("topic_id", topicIds);
      
      masteryData = mastery || [];
    }

    // ============= Build combined response =============
    const masteryMap = new Map(masteryData.map(m => [m.topic_id, m.mastery_score]));
    
    const enrichedMetrics = (yieldMetrics || []).map(metric => {
      const topic = metric.topics as unknown as {
        id: string;
        title: string;
        status: string;
        exam_importance: number;
        difficulty_weight: number;
      };
      
      return {
        topic_id: metric.topic_id,
        topic_title: topic?.title || 'Unknown',
        topic_status: topic?.status || 'not_started',
        frequency_count: metric.frequency_count,
        normalized_yield: metric.normalized_yield,
        total_weight: metric.total_weight,
        exam_count: metric.exam_count,
        exam_importance: topic?.exam_importance || 3,
        difficulty_weight: topic?.difficulty_weight || 3,
        mastery_score: masteryMap.get(metric.topic_id) || 0,
        // Calculate priority score: high yield + low mastery = high priority
        priority_score: (metric.normalized_yield * 0.5) + ((100 - (masteryMap.get(metric.topic_id) || 0)) / 100 * 0.5),
      };
    });

    // Sort by priority for recommendations
    const prioritizedTopics = [...enrichedMetrics].sort((a, b) => b.priority_score - a.priority_score);

    // Calculate summary stats
    const totalExamsAnalyzed = pastExams?.filter(e => e.analysis_status === 'completed').length || 0;
    const topicsWithYieldData = enrichedMetrics.length;
    const highYieldCount = enrichedMetrics.filter(m => m.normalized_yield >= 0.7).length;
    const weakHighYieldTopics = enrichedMetrics.filter(m => 
      m.normalized_yield >= 0.5 && m.mastery_score < 50
    );

    return new Response(
      JSON.stringify({
        success: true,
        course: {
          id: course.id,
          title: course.title,
        },
        summary: {
          exams_analyzed: totalExamsAnalyzed,
          topics_with_yield_data: topicsWithYieldData,
          high_yield_topics: highYieldCount,
          weak_high_yield_count: weakHighYieldTopics.length,
        },
        yield_metrics: enrichedMetrics,
        prioritized_topics: prioritizedTopics.slice(0, 10),
        weak_high_yield_topics: weakHighYieldTopics,
        past_exams: pastExams || [],
        recommendations: generateRecommendations(enrichedMetrics, weakHighYieldTopics),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-yield-summary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface EnrichedMetric {
  topic_id: string;
  topic_title: string;
  normalized_yield: number;
  mastery_score: number;
  priority_score: number;
}

function generateRecommendations(
  metrics: EnrichedMetric[],
  weakHighYield: EnrichedMetric[]
): string[] {
  const recommendations: string[] = [];

  if (metrics.length === 0) {
    recommendations.push("Upload and analyze past exams to discover high-yield topics");
    return recommendations;
  }

  if (weakHighYield.length > 0) {
    const topicNames = weakHighYield.slice(0, 3).map(t => t.topic_title).join(", ");
    recommendations.push(`Focus on: ${topicNames} - high yield but low mastery`);
  }

  const highYieldTopics = metrics.filter(m => m.normalized_yield >= 0.7);
  if (highYieldTopics.length > 0) {
    recommendations.push(`${highYieldTopics.length} topics appear frequently in past exams`);
  }

  const lowYieldTopics = metrics.filter(m => m.normalized_yield < 0.3);
  if (lowYieldTopics.length > 0 && metrics.length > 5) {
    recommendations.push(`${lowYieldTopics.length} topics rarely appear - consider deprioritizing`);
  }

  return recommendations;
}
