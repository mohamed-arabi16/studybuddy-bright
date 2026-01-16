import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizAnswer {
  question_id: string;
  user_answer: string;
  is_correct?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { 
      topic_id, 
      quiz_bank_id, 
      answers, 
      time_spent_sec = 0,
      score // Can be pre-calculated client-side or computed here
    } = body;

    // Validate input
    if (!topic_id) {
      return new Response(
        JSON.stringify({ error: "topic_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: "answers array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= P0: AUTH GUARD =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    // ============= Verify ownership of topic =============
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("id, title, user_id, course_id")
      .eq("id", topic_id)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: "Topic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (topic.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Access denied - you don't own this topic" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Calculate score if not provided =============
    let computedScore = score;
    let correctAnswers = 0;
    const questionsAnswered = answers.length;

    if (quiz_bank_id && computedScore === undefined) {
      // Fetch quiz to validate answers
      const { data: quiz, error: quizError } = await supabase
        .from("quiz_bank")
        .select("questions")
        .eq("id", quiz_bank_id)
        .single();

      if (!quizError && quiz && quiz.questions) {
        const questions = quiz.questions as Array<{
          id: string;
          correct_answer: string;
        }>;
        
        for (const answer of answers as QuizAnswer[]) {
          const question = questions.find(q => q.id === answer.question_id);
          if (question) {
            const isCorrect = answer.user_answer.toLowerCase().trim() === 
                             question.correct_answer.toLowerCase().trim();
            answer.is_correct = isCorrect;
            if (isCorrect) correctAnswers++;
          }
        }
        
        computedScore = questionsAnswered > 0 
          ? Math.round((correctAnswers / questionsAnswered) * 100) 
          : 0;
      }
    }

    // Default score if still not set
    if (computedScore === undefined) {
      computedScore = 0;
    }

    // ============= Record quiz attempt =============
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        topic_id,
        quiz_bank_id: quiz_bank_id || null,
        score: computedScore,
        time_spent_sec,
        answers,
        questions_answered: questionsAnswered,
        correct_answers: correctAnswers,
      })
      .select()
      .single();

    if (attemptError) {
      console.error("[submit-quiz-attempt] Error recording attempt:", attemptError);
      return new Response(
        JSON.stringify({ error: "Failed to record quiz attempt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Update mastery score using the helper function =============
    const { data: masteryResult, error: masteryError } = await supabase
      .rpc('update_mastery_from_quiz', {
        p_user_id: user.id,
        p_topic_id: topic_id,
        p_quiz_score: computedScore,
        p_time_spent_sec: time_spent_sec,
      });

    if (masteryError) {
      console.error("[submit-quiz-attempt] Error updating mastery:", masteryError);
      // Don't fail the request, mastery update is secondary
    }

    // ============= Get updated mastery data =============
    const { data: mastery } = await supabase
      .from("topic_mastery")
      .select("mastery_score, confidence, quiz_attempts_count, last_assessed_at")
      .eq("user_id", user.id)
      .eq("topic_id", topic_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        attempt: {
          id: attempt.id,
          score: computedScore,
          questions_answered: questionsAnswered,
          correct_answers: correctAnswers,
          time_spent_sec,
        },
        mastery_update: masteryResult || null,
        current_mastery: mastery || null,
        topic: {
          id: topic.id,
          title: topic.title,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[submit-quiz-attempt] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
