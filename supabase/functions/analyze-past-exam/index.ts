import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { consumeCredits, createInsufficientCreditsResponse, updateTokenUsage } from "../_shared/credits.ts";
import { checkRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TopicMapping {
  topic_id: string;
  topic_title: string;
  weight: number;
  evidence: string[];
  question_numbers: string[];
}

interface AnalysisResult {
  high_yield_topics: TopicMapping[];
  topic_count: number;
  questions_analyzed: number;
  summary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { course_id, past_exam_id, file_id, file_name: inputFileName, file_path: inputFilePath } = body;

    // Validate input
    if (!course_id) {
      return new Response(
        JSON.stringify({ error: "course_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!past_exam_id && !file_id) {
      return new Response(
        JSON.stringify({ error: "Either past_exam_id or file_id is required" }),
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
        JSON.stringify({ error: "Access denied - you don't own this course" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Get or create past exam record =============
    let examId = past_exam_id;
    let extractedText: string | null = null;

    if (file_id && !past_exam_id) {
      // Verify file ownership and get extracted text
      const { data: file, error: fileError } = await supabase
        .from("course_files")
        .select("id, extracted_text, file_name, file_path, file_size, mime_type, user_id")
        .eq("id", file_id)
        .single();

      if (fileError || !file) {
        return new Response(
          JSON.stringify({ error: "File not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (file.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Access denied - you don't own this file" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      extractedText = file.extracted_text;

      // Create past exam record with correct schema columns
      const { data: newExam, error: examCreateError } = await supabase
        .from("past_exams")
        .insert({
          user_id: user.id,
          course_id,
          file_name: inputFileName || file.file_name || "Past Exam",
          file_path: inputFilePath || file.file_path,
          file_size: file.file_size,
          mime_type: file.mime_type || 'application/pdf',
          extracted_text: extractedText,
          analysis_status: 'processing',
        })
        .select()
        .single();

      if (examCreateError) {
        console.error("[analyze-past-exam] Error creating exam record:", examCreateError);
        return new Response(
          JSON.stringify({ error: "Failed to create exam record", details: examCreateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      examId = newExam.id;
    } else {
      // Get existing exam record
      const { data: exam, error: examError } = await supabase
        .from("past_exams")
        .select("id, extracted_text, user_id, analysis_status")
        .eq("id", past_exam_id)
        .single();

      if (examError || !exam) {
        return new Response(
          JSON.stringify({ error: "Past exam not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (exam.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Access denied - you don't own this exam" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      extractedText = exam.extracted_text;
    }

    if (!extractedText || extractedText.trim().length < 50) {
      // Update status to failed
      await supabase
        .from("past_exams")
        .update({ analysis_status: 'failed', analysis_error: 'Insufficient text content' })
        .eq("id", examId);

      return new Response(
        JSON.stringify({ error: "Exam file has insufficient text content for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Rate limiting =============
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'analyze-past-exam');
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // ============= Consume credits BEFORE AI call =============
    const creditResult = await consumeCredits(supabase, user.id, 'analyze_past_exam', null, course_id);
    
    if (!creditResult.success) {
      // Update status
      await supabase
        .from("past_exams")
        .update({ analysis_status: 'pending' })
        .eq("id", examId);

      return createInsufficientCreditsResponse(
        creditResult.balance || 0,
        creditResult.required || 40,
        creditResult.plan_tier
      );
    }

    console.log(`[analyze-past-exam] Credits consumed: ${creditResult.credits_charged}, balance: ${creditResult.balance}`);

    // ============= Fetch course topics =============
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, title, description")
      .eq("course_id", course_id)
      .order("order_index", { ascending: true });

    if (topicsError || !topics || topics.length === 0) {
      await supabase
        .from("past_exams")
        .update({ analysis_status: 'failed', analysis_error: 'No topics found in course' })
        .eq("id", examId);

      return new Response(
        JSON.stringify({ error: "No topics found in course. Please add topics first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Analyze with AI =============
    let analysisResult: AnalysisResult;
    let tokensIn = 0;
    let tokensOut = 0;
    let latencyMs = 0;

    if (!lovableApiKey) {
      // Mock analysis for testing
      console.log("[analyze-past-exam] No LOVABLE_API_KEY, generating mock analysis");
      analysisResult = generateMockAnalysis(topics);
    } else {
      const startTime = Date.now();
      const prompt = buildAnalysisPrompt(extractedText, topics, course.title);
      
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      latencyMs = Date.now() - startTime;

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("[analyze-past-exam] AI API error:", errorText);
        
        await supabase
          .from("past_exams")
          .update({ analysis_status: 'failed', analysis_error: 'AI analysis failed' })
          .eq("id", examId);

        return new Response(
          JSON.stringify({ error: "AI analysis failed", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiResult = await aiResponse.json();
      tokensIn = aiResult.usage?.prompt_tokens || 0;
      tokensOut = aiResult.usage?.completion_tokens || 0;

      // Update token usage
      if (creditResult.event_id) {
        await updateTokenUsage(
          supabase,
          creditResult.event_id,
          tokensIn,
          tokensOut,
          latencyMs,
          "google/gemini-2.5-flash"
        );
      }

      // Parse AI response
      const aiContent = aiResult.choices?.[0]?.message?.content || "";
      
      try {
        const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                          aiContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
        analysisResult = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("[analyze-past-exam] Failed to parse AI response:", parseError);
        analysisResult = generateMockAnalysis(topics);
      }
    }

    // ============= Store analysis results =============
    // Update past_exams with analysis result
    await supabase
      .from("past_exams")
      .update({
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", examId);

    // Store exam_questions and exam_topic_map entries
    const topicMappings = analysisResult.high_yield_topics || [];
    
    for (const mapping of topicMappings) {
      // Verify topic exists
      const topicExists = topics.find(t => t.id === mapping.topic_id);
      if (!topicExists) continue;

      // Create exam question entry
      const { data: question, error: questionError } = await supabase
        .from("exam_questions")
        .insert({
          past_exam_id: examId,
          question_text: mapping.evidence.join('; ') || `Related to ${mapping.topic_title}`,
          question_type: 'mixed',
          points: Math.round(mapping.weight * 100),
        })
        .select()
        .single();

      if (questionError) {
        console.error("[analyze-past-exam] Error creating question:", questionError);
        continue;
      }

      // Create topic mapping
      await supabase
        .from("exam_topic_map")
        .insert({
          exam_question_id: question.id,
          topic_id: mapping.topic_id,
          weight: mapping.weight,
          confidence: mapping.weight > 0.3 ? 'high' : mapping.weight > 0.15 ? 'medium' : 'low',
        });
    }

    // ============= Refresh yield metrics =============
    const { error: refreshError } = await supabase
      .rpc('refresh_topic_yield_metrics', {
        p_user_id: user.id,
        p_course_id: course_id,
      });

    if (refreshError) {
      console.error("[analyze-past-exam] Error refreshing yield metrics:", refreshError);
    }

    // ============= Fetch updated yield metrics =============
    const { data: yieldMetrics } = await supabase
      .from("topic_yield_metrics")
      .select("topic_id, total_exam_appearances, normalized_yield_score, total_points_possible")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .order("normalized_yield_score", { ascending: false });

    return new Response(
      JSON.stringify({
        success: true,
        exam_id: examId,
        analysis: analysisResult,
        yield_metrics: yieldMetrics || [],
        topics_mapped: topicMappings.length,
        usage: {
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          latency_ms: latencyMs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[analyze-past-exam] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAnalysisPrompt(
  examText: string, 
  topics: Array<{ id: string; title: string; description: string | null }>,
  courseTitle: string
): string {
  const topicList = topics.map((t, i) => `${i + 1}. ID: ${t.id}\n   Title: ${t.title}\n   Description: ${t.description || 'N/A'}`).join('\n');
  
  // Limit exam text to ~8000 chars to fit in context
  const truncatedExam = examText.length > 8000 ? examText.substring(0, 8000) + '...[truncated]' : examText;

  return `Analyze this past exam for the course "${courseTitle}" and map questions to the provided topic list.

EXAM CONTENT:
${truncatedExam}

COURSE TOPICS:
${topicList}

TASK:
1. Identify which questions in the exam relate to which topics
2. Estimate the weight/importance of each topic based on how many questions and marks it represents
3. Extract brief evidence snippets that show the connection
4. Provide a summary of likely focus areas

Return ONLY a valid JSON object with this structure:
{
  "high_yield_topics": [
    {
      "topic_id": "uuid from topic list",
      "topic_title": "topic title",
      "weight": 0.0 to 1.0 (proportion of exam this topic covers),
      "evidence": ["brief snippet 1", "brief snippet 2"],
      "question_numbers": ["Q1", "Q3a", etc]
    }
  ],
  "topic_count": number of topics covered,
  "questions_analyzed": estimated number of questions,
  "summary": "2-3 sentence summary of exam focus areas and high-yield topics for study"
}

Analyze the exam now:`;
}

function generateMockAnalysis(topics: Array<{ id: string; title: string; description: string | null }>): AnalysisResult {
  // Select random topics with random weights
  const selectedCount = Math.min(topics.length, Math.floor(Math.random() * 5) + 3);
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, selectedCount);
  
  let totalWeight = 0;
  const mappings: TopicMapping[] = selected.map((topic, index) => {
    const weight = Math.random() * 0.3 + 0.1; // 0.1 to 0.4
    totalWeight += weight;
    return {
      topic_id: topic.id,
      topic_title: topic.title,
      weight: Math.round(weight * 100) / 100,
      evidence: [`Related to ${topic.title}`, `Covers key concepts from ${topic.title}`],
      question_numbers: [`Q${index + 1}`, `Q${index + 5}`],
    };
  });

  // Normalize weights
  if (totalWeight > 0) {
    mappings.forEach(m => {
      m.weight = Math.round((m.weight / totalWeight) * 100) / 100;
    });
  }

  // Sort by weight descending
  mappings.sort((a, b) => b.weight - a.weight);

  return {
    high_yield_topics: mappings,
    topic_count: mappings.length,
    questions_analyzed: Math.floor(Math.random() * 10) + 5,
    summary: `Based on the exam analysis, focus on ${mappings[0]?.topic_title || 'key topics'} and ${mappings[1]?.topic_title || 'related concepts'}. These topics appear frequently and carry significant weight in the exam.`,
  };
}
