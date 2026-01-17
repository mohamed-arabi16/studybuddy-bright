import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { consumeCredits, updateTokenUsage, createInsufficientCreditsResponse } from "../_shared/credits.ts";

// P0 Fix: Complete CORS headers with methods and max-age
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Rate limiting constants
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, notes, courseId } = await req.json();

    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "Topic title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // P1 Fix: Rate limiting - check recent analyze-topic calls
    const tenMinutesAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    
    const { count: recentCalls } = await supabase
      .from('ai_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('job_type', 'analyze_topic')
      .gte('created_at', tenMinutesAgo);

    if ((recentCalls || 0) >= RATE_LIMIT) {
      return new Response(JSON.stringify({ 
        error: "Rate limit exceeded. Please wait a few minutes before analyzing more topics.",
        code: "RATE_LIMIT_EXCEEDED",
        retry_after_seconds: 600,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= P2: CONSUME CREDITS BEFORE AI CALL =============
    const creditResult = await consumeCredits(supabase, user.id, 'analyze_topic', null, courseId);
    
    if (!creditResult.success) {
      console.log(`Insufficient credits for analyze_topic: user ${user.id}, have ${creditResult.balance}, need ${creditResult.required}`);
      return createInsufficientCreditsResponse(
        creditResult.balance || 0,
        creditResult.required || 5,
        creditResult.plan_tier
      );
    }
    
    console.log(`Credits consumed for analyze_topic: charged ${creditResult.credits_charged}, balance ${creditResult.balance}`);
    const creditEventId = creditResult.event_id;
    const aiCallStartTime = Date.now();

    // P1 Fix: Fetch course context for better scoring
    let courseContext = "";
    if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('title, description')
        .eq('id', courseId)
        .eq('user_id', user.id)
        .single();
      
      if (course) {
        courseContext = `Course: ${course.title}${course.description ? ` - ${course.description}` : ''}`;
      }
    }

    console.log(`Analyzing topic: "${title}" for user ${user.id}${courseContext ? ` (${courseContext})` : ''}`);

    // Enhanced system prompt with domain-specific heuristics
    const systemPrompt = `You are an expert educational AI assistant specializing in academic content analysis.
Given a topic title, course context, and optional notes, analyze and call the analyze_topic tool.

DIFFICULTY ASSESSMENT FRAMEWORK (1-5):
Use these domain-specific indicators:

1 (Very Easy):
- Basic definitions and terminology
- Introductory/overview concepts
- Historical context or background
- Simple memorization tasks

2 (Easy):
- Single-step procedures
- Direct applications of formulas
- Straightforward classifications
- Basic comparisons

3 (Medium):
- Multi-step problem solving
- Moderate mathematical reasoning
- Connecting two or more concepts
- Analysis with some abstraction

4 (Hard):
- Complex analysis requiring synthesis
- Mathematical proofs or derivations
- Advanced applications
- Abstract conceptual reasoning

5 (Very Hard):
- Expert-level theory
- Complex mathematical derivations
- Multi-domain integration
- Cutting-edge or specialized content

DIFFICULTY MODIFIERS:
+1 if topic contains: formulas, equations, proofs, algorithms
+1 if topic requires: multiple prerequisites, abstract thinking
-1 if topic is: definition-based, terminology, historical

EXAM IMPORTANCE FRAMEWORK (1-5):

1 (Rarely tested):
- Supplementary material
- "Nice to know" information
- Tangential topics

2 (Occasionally tested):
- Minor concepts
- Extension material
- Less common applications

3 (Moderately tested):
- Standard curriculum material
- Supporting concepts
- Secondary learning objectives

4 (Frequently tested):
- Core course concepts
- Primary learning objectives
- Commonly examined topics

5 (Always tested):
- Fundamental principles
- Key theories and models
- Exam staples in the field

IMPORTANCE MODIFIERS:
+1 if topic is: foundational, prerequisite for others, core concept
+1 if topic appears: in chapter summaries, learning objectives
-1 if topic is: advanced/specialized, optional reading

You MUST call the analyze_topic function. Do not return text responses.`;

    // Build user prompt with course context
    const userPrompt = courseContext
      ? `${courseContext}\n\nTopic: ${title}${notes ? `\nNotes: ${notes}` : ''}`
      : `Topic: ${title}${notes ? `\nNotes: ${notes}` : ''}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_topic",
              description: "Analyze a study topic and return difficulty and importance weights",
              parameters: {
                type: "object",
                properties: {
                  difficulty_weight: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                    description: "Difficulty level 1-5",
                  },
                  exam_importance: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                    description: "Exam importance 1-5",
                  },
                },
                required: ["difficulty_weight", "exam_importance"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_topic" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiCallEndTime = Date.now();
    const aiLatencyMs = aiCallEndTime - aiCallStartTime;
    
    // ============= P2: TRACK TOKEN USAGE =============
    const usage = aiResponse.usage;
    if (creditEventId && usage) {
      await updateTokenUsage(
        supabase,
        creditEventId,
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        aiLatencyMs,
        aiResponse.model || 'google/gemini-2.5-flash',
        { model: aiResponse.model, usage }
      );
    }
    
    // P0 Fix: Log only metadata, not full response
    console.log("AI response metadata:", {
      model: aiResponse.model,
      hasToolCalls: !!aiResponse.choices?.[0]?.message?.tool_calls?.length,
      finishReason: aiResponse.choices?.[0]?.finish_reason,
      usage: aiResponse.usage,
      latencyMs: aiLatencyMs,
    });

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    // P1 Fix: Add content fallback parsing if no tool call
    if (!toolCall?.function?.arguments) {
      // Try parsing message content as fallback
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          const contentParsed = JSON.parse(content.replace(/```json|```/g, '').trim());
          if (contentParsed.difficulty_weight && contentParsed.exam_importance) {
            const diffWeight = Math.min(5, Math.max(1, contentParsed.difficulty_weight));
            const examImp = Math.min(5, Math.max(1, contentParsed.exam_importance));
            
            // Log the analysis call
            await supabase.from('ai_jobs').insert({
              user_id: user.id,
              course_id: courseId || null,
              job_type: 'analyze_topic',
              status: 'completed',
              input_hash: title.toLowerCase().trim().substring(0, 100),
              result_json: { difficulty_weight: diffWeight, exam_importance: examImp, fallback: true },
            });
            
            return new Response(JSON.stringify({
              difficulty_weight: diffWeight,
              exam_importance: examImp,
              needs_review: true,
              fallback_reason: "content_parse",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch {
          // Fall through to defaults
        }
      }
      
      console.warn("No tool call or parseable content, using defaults");
      
      // Log the analysis call with defaults
      await supabase.from('ai_jobs').insert({
        user_id: user.id,
        course_id: courseId || null,
        job_type: 'analyze_topic',
        status: 'completed',
        input_hash: title.toLowerCase().trim().substring(0, 100),
        result_json: { difficulty_weight: 3, exam_importance: 3, fallback: true },
      });
      
      return new Response(JSON.stringify({
        difficulty_weight: 3,
        exam_importance: 3,
        needs_review: true,
        fallback_reason: "no_tool_call",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // P0 Fix: Safe JSON parsing with try-catch
    let analysis: { difficulty_weight?: number; exam_importance?: number };
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.warn("Failed to parse tool arguments:", parseError);
      
      // Log the analysis call with defaults
      await supabase.from('ai_jobs').insert({
        user_id: user.id,
        course_id: courseId || null,
        job_type: 'analyze_topic',
        status: 'completed',
        input_hash: title.toLowerCase().trim().substring(0, 100),
        result_json: { difficulty_weight: 3, exam_importance: 3, parse_error: true },
      });
      
      return new Response(JSON.stringify({
        difficulty_weight: 3,
        exam_importance: 3,
        needs_review: true,
        fallback_reason: "parse_error",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate and clamp values
    const difficultyWeight = Math.min(5, Math.max(1, analysis.difficulty_weight || 3));
    const examImportance = Math.min(5, Math.max(1, analysis.exam_importance || 3));

    console.log(`Analysis complete: difficulty=${difficultyWeight}, importance=${examImportance}`);

    // Log the successful analysis call
    await supabase.from('ai_jobs').insert({
      user_id: user.id,
      course_id: courseId || null,
      job_type: 'analyze_topic',
      status: 'completed',
      input_hash: title.toLowerCase().trim().substring(0, 100),
      result_json: { difficulty_weight: difficultyWeight, exam_importance: examImportance },
    });

    // ============= TRACK SUBSCRIPTION USAGE FOR REFUND ELIGIBILITY =============
    try {
      await supabase.rpc('increment_subscription_usage', {
        p_user_id: user.id,
        p_counter_name: 'topic_deepdives_count',
        p_increment_by: 1
      });
    } catch (usageErr) {
      console.error("Failed to track topic deepdive usage:", usageErr);
    }

    // P1 Fix: Add needs_review flag to distinguish AI vs defaults
    return new Response(JSON.stringify({
      difficulty_weight: difficultyWeight,
      exam_importance: examImportance,
      needs_review: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-topic:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
