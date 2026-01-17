import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { consumeCredits, createInsufficientCreditsResponse, updateTokenUsage } from "../_shared/credits.ts";
import { checkRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short_answer';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { course_id, topic_id, difficulty = 'medium', count = 6 } = body;

    // Validate input
    if (!course_id || !topic_id) {
      return new Response(
        JSON.stringify({ error: "course_id and topic_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return new Response(
        JSON.stringify({ error: "difficulty must be 'easy', 'medium', or 'hard'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= P0: AUTH GUARD =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    // ============= Verify ownership of course/topic =============
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("id, title, description, course_id, user_id, courses(id, title, user_id)")
      .eq("id", topic_id)
      .eq("course_id", course_id)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: "Topic not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user owns the topic/course
    if (topic.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Access denied - you don't own this topic" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Check cache first =============
    // Look for existing quiz in quiz_bank with same topic_id and difficulty
    const { data: cachedQuiz, error: cacheError } = await supabase
      .from("quiz_bank")
      .select("*")
      .eq("topic_id", topic_id)
      .eq("difficulty", difficulty)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedQuiz) {
      console.log(`[generate-quiz] Cache hit for topic ${topic_id}, difficulty ${difficulty}`);
      const questions = cachedQuiz.questions as QuizQuestion[];
      return new Response(
        JSON.stringify({
          success: true,
          cache_hit: true,
          quiz: {
            id: cachedQuiz.id,
            topic_id: cachedQuiz.topic_id,
            topic_title: topic.title,
            difficulty: cachedQuiz.difficulty,
            questions: questions,
            question_count: questions.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Rate limiting =============
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'generate-quiz');
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // ============= Consume credits BEFORE AI call =============
    const creditResult = await consumeCredits(supabase, user.id, 'generate_quiz', null, course_id);
    
    if (!creditResult.success) {
      return createInsufficientCreditsResponse(
        creditResult.balance || 0,
        creditResult.required || 8,
        creditResult.plan_tier
      );
    }

    console.log(`[generate-quiz] Credits consumed: ${creditResult.credits_charged}, balance: ${creditResult.balance}`);

    // ============= Generate quiz with AI =============
    if (!anthropicApiKey) {
      // Fallback: Generate mock quiz for testing without API key
      console.log("[generate-quiz] No ANTHROPIC_API_KEY, generating mock quiz");
      const mockQuestions = generateMockQuiz(topic.title, topic.description || '', difficulty, count);
      
      // Save to quiz_bank - only use columns that exist in the table
      const { data: savedQuiz, error: saveError } = await supabase
        .from("quiz_bank")
        .insert({
          topic_id,
          difficulty,
          version: 1,
          questions: mockQuestions,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      if (saveError) {
        console.error("[generate-quiz] Error saving quiz:", saveError);
        // Return error if save failed - quiz ID is required for attempt tracking
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to save quiz to database",
            details: saveError.message,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          cache_hit: false,
          quiz: {
            id: savedQuiz.id,
            topic_id,
            topic_title: topic.title,
            difficulty,
            questions: mockQuestions,
            question_count: mockQuestions.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Claude API
    const startTime = Date.now();
    // Handle course relationship - Supabase returns it as an object, not array
    const courseData = topic.courses as unknown as { title: string } | null;
    const courseTitle = courseData?.title || 'Unknown Course';
    
    const prompt = buildQuizPrompt(topic.title, topic.description || '', courseTitle, difficulty, count);
    
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error("[generate-quiz] Claude API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await anthropicResponse.json();
    const tokensIn = aiResult.usage?.input_tokens || 0;
    const tokensOut = aiResult.usage?.output_tokens || 0;

    // Update token usage for analytics
    if (creditResult.event_id) {
      await updateTokenUsage(
        supabase,
        creditResult.event_id,
        tokensIn,
        tokensOut,
        latencyMs,
        "claude-sonnet-4-20250514"
      );
    }

    // Parse AI response
    const aiContent = aiResult.content?.[0]?.text || "";
    let questions: QuizQuestion[];
    
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      questions = JSON.parse(jsonStr);
      
      // Validate structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("Invalid quiz structure");
      }
      
      // Add IDs if missing
      questions = questions.map((q, i) => ({
        ...q,
        id: q.id || `q-${i + 1}`,
      }));
    } catch (parseError) {
      console.error("[generate-quiz] Failed to parse AI response:", parseError);
      // Fall back to mock quiz
      questions = generateMockQuiz(topic.title, topic.description || '', difficulty, count);
    }

    // Save to quiz_bank cache - only use columns that exist in the table
    const { data: savedQuiz, error: saveError } = await supabase
      .from("quiz_bank")
      .insert({
        topic_id,
        difficulty,
        version: 1,
        questions,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (saveError) {
      console.error("[generate-quiz] Error saving quiz to cache:", saveError);
      // Return error if save failed - quiz ID is required for attempt tracking
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save quiz to database",
          details: saveError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cache_hit: false,
        quiz: {
          id: savedQuiz.id,
          topic_id,
          topic_title: topic.title,
          difficulty,
          questions,
          question_count: questions.length,
        },
        usage: {
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          latency_ms: latencyMs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-quiz] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildQuizPrompt(topicTitle: string, topicDescription: string, courseTitle: string, difficulty: string, count: number): string {
  const difficultyGuide = {
    easy: "basic recall and simple understanding questions",
    medium: "application and analysis questions requiring deeper understanding",
    hard: "synthesis, evaluation, and complex problem-solving questions",
  };

  return `Generate a quiz for the following topic:

Course: ${courseTitle}
Topic: ${topicTitle}
Description: ${topicDescription || 'No description provided'}
Difficulty: ${difficulty} (${difficultyGuide[difficulty as keyof typeof difficultyGuide]})
Number of questions: ${count}

Requirements:
1. Generate ${Math.floor(count * 0.7)} multiple choice questions (MCQ) and ${Math.ceil(count * 0.3)} short answer questions
2. MCQ should have exactly 4 options (A, B, C, D)
3. Each question must have a clear correct answer
4. Include a brief explanation for each answer
5. Questions should be appropriate for university/college level students

Return ONLY a valid JSON array with this exact structure:
[
  {
    "id": "q-1",
    "type": "mcq",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "A",
    "explanation": "Brief explanation of why this is correct"
  },
  {
    "id": "q-2",
    "type": "short_answer",
    "question": "Question text here?",
    "correct_answer": "Expected answer or key points",
    "explanation": "Explanation or marking guidance"
  }
]

Generate the quiz now:`;
}

function generateMockQuiz(topicTitle: string, _topicDescription: string, difficulty: string, count: number): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const mcqCount = Math.floor(count * 0.7);
  const shortAnswerCount = count - mcqCount;

  // Generate MCQs
  for (let i = 0; i < mcqCount; i++) {
    questions.push({
      id: `q-${i + 1}`,
      type: 'mcq',
      question: `[${difficulty.toUpperCase()}] What is an important concept related to "${topicTitle}"? (Question ${i + 1})`,
      options: [
        `Correct answer about ${topicTitle}`,
        `Incorrect option 1`,
        `Incorrect option 2`,
        `Incorrect option 3`,
      ],
      correct_answer: 'A',
      explanation: `This is the correct answer because it directly relates to the key concepts of ${topicTitle}.`,
    });
  }

  // Generate short answer
  for (let i = 0; i < shortAnswerCount; i++) {
    questions.push({
      id: `q-${mcqCount + i + 1}`,
      type: 'short_answer',
      question: `[${difficulty.toUpperCase()}] Explain a key concept from "${topicTitle}" in your own words. (Question ${mcqCount + i + 1})`,
      correct_answer: `The student should explain the fundamental aspects of ${topicTitle}, including key definitions, applications, and relationships to other concepts.`,
      explanation: `A good answer should demonstrate understanding of the core principles and be able to articulate them clearly.`,
    });
  }

  return questions;
}
