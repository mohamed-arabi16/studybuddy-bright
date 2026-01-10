import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (step: string, details?: unknown) => {
  console.log(`[ocr-pages] ${step}`, details ? JSON.stringify(details) : '');
};

interface PageInput {
  pageNumber: number;
  imageBase64: string;
}

interface PageOutput {
  pageNumber: number;
  text: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { courseId, fileId, pages } = await req.json() as {
      courseId: string;
      fileId: string;
      pages: PageInput[];
    };

    if (!courseId || !fileId || !pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response(
        JSON.stringify({ error: "courseId, fileId, and pages array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit batch size to prevent timeouts
    if (pages.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximum 5 pages per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("OCR request", { 
      fileId, 
      userId: user.id, 
      pageCount: pages.length,
      pageNumbers: pages.map(p => p.pageNumber),
    });

    // Verify file ownership
    const { data: fileRecord, error: fileError } = await supabase
      .from("course_files")
      .select("id, user_id, course_id")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .single();

    if (fileError || !fileRecord) {
      log("File not found", { fileError });
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OCR prompt focused on academic content structure
    const ocrPrompt = `Extract text from this academic document page.

FOCUS ON:
- Headings and section titles
- Topic names and chapter titles
- Key terms and definitions
- Bullet points and numbered lists
- Learning objectives

RULES:
- Preserve the structure and hierarchy
- Mark unclear text with [unclear]
- Do NOT summarize - extract exactly as shown
- If it's a diagram or image with labels, extract the labels

Return the extracted text in a clean, structured format.`;

    // Process each page with AI Vision
    const results: PageOutput[] = [];
    
    for (const page of pages) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: ocrPrompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${page.imageBase64}`,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          log("AI error for page", { pageNumber: page.pageNumber, status: aiResponse.status });
          results.push({
            pageNumber: page.pageNumber,
            text: `[OCR failed for page ${page.pageNumber}]`,
          });
          continue;
        }

        const aiData = await aiResponse.json();
        const extractedText = aiData.choices?.[0]?.message?.content || "";
        
        results.push({
          pageNumber: page.pageNumber,
          text: extractedText,
        });
        
        log("Page OCR complete", { pageNumber: page.pageNumber, chars: extractedText.length });
        
      } catch (pageError) {
        log("Page OCR error", { pageNumber: page.pageNumber, error: pageError });
        results.push({
          pageNumber: page.pageNumber,
          text: `[OCR error for page ${page.pageNumber}]`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pages: results,
        processed: results.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    log("Error", { message: error instanceof Error ? error.message : "Unknown error" });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
