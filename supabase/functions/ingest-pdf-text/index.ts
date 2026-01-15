import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (step: string, details?: unknown) => {
  console.log(`[ingest-pdf-text] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============= P0: AUTH GUARD (Zombie Session Fix) =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    const { fileId, extractedText, totalPages } = await req.json();

    if (!fileId || !extractedText) {
      return new Response(
        JSON.stringify({ error: "fileId and extractedText are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Ingesting text", { fileId, userId: user.id, textLength: extractedText.length, totalPages });

    // Verify file ownership
    const { data: fileRecord, error: fileError } = await supabase
      .from("course_files")
      .select("id, user_id, file_name, extraction_status")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .single();

    if (fileError || !fileRecord) {
      log("File not found or unauthorized", { fileError });
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate extraction run ID
    const extractionRunId = crypto.randomUUID();

    // Determine quality based on text length
    let extractionQuality: 'high' | 'medium' | 'low' = 'medium';
    if (extractedText.length > 5000) {
      extractionQuality = 'high';
    } else if (extractedText.length > 1000) {
      extractionQuality = 'medium';
    } else {
      extractionQuality = 'low';
    }

    // Save extracted text
    const { error: updateError } = await supabase
      .from("course_files")
      .update({
        extraction_status: "extracted",
        extracted_text: extractedText.substring(0, 100000), // Limit to 100k chars
        extraction_method: "pdf_text",
        extraction_quality: extractionQuality,
        extraction_run_id: extractionRunId,
        extraction_metadata: {
          method: "pdf_text",
          characters_extracted: extractedText.length,
          total_pages: totalPages,
          extraction_run_id: extractionRunId,
        },
      })
      .eq("id", fileId);

    if (updateError) {
      log("Update error", { updateError });
      return new Response(
        JSON.stringify({ error: "Failed to save extracted text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Text ingested successfully", { 
      fileId, 
      characters: extractedText.length, 
      quality: extractionQuality,
      extractionRunId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "extracted",
        message: "Text extracted successfully. Ready to extract topics.",
        characters: extractedText.length,
        extraction_quality: extractionQuality,
        extraction_run_id: extractionRunId,
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
