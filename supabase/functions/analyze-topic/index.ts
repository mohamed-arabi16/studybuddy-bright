import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { title, notes } = await req.json();

    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "Topic title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Analyzing topic: "${title}" for user ${user.id}`);

    const systemPrompt = `You are an educational AI assistant that analyzes study topics for exam preparation.
Given a topic title (and optional notes), estimate:
1. difficulty_weight (1-5): How difficult is this topic? 1=very easy, 5=very hard
2. exam_importance (1-5): How likely is this topic to appear in exams? 1=rarely, 5=almost always

Consider:
- Mathematical/technical topics are usually harder
- Foundational concepts are usually more important for exams
- Advanced/specialized topics may be harder but less frequent in exams

Return ONLY a JSON object with these two fields, no explanation.`;

    const userPrompt = notes 
      ? `Topic: ${title}\nNotes: ${notes}`
      : `Topic: ${title}`;

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
    console.log("AI response:", JSON.stringify(aiResponse));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      // Fallback to default values
      console.warn("No tool call in response, using defaults");
      return new Response(JSON.stringify({
        difficulty_weight: 3,
        exam_importance: 3,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    
    // Validate and clamp values
    const difficultyWeight = Math.min(5, Math.max(1, analysis.difficulty_weight || 3));
    const examImportance = Math.min(5, Math.max(1, analysis.exam_importance || 3));

    console.log(`Analysis complete: difficulty=${difficultyWeight}, importance=${examImportance}`);

    return new Response(JSON.stringify({
      difficulty_weight: difficultyWeight,
      exam_importance: examImportance,
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
