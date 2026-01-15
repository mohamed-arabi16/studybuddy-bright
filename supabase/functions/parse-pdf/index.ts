import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// P0: File size limit to prevent OOM
const MAX_FILE_SIZE_MB = 10;

// Logging helper
const log = (step: string, details?: unknown) => {
  console.log(`[parse-pdf] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============= P0: AUTH GUARD (Zombie Session Fix) =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    // ============= P0-2: RATE LIMITING =============
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'parse-pdf');
    if (!rateLimitResult.allowed) {
      log("Rate limit exceeded", { userId: user.id });
      return createRateLimitResponse(rateLimitResult);
    }

    const { fileId } = await req.json();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "fileId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Processing file", { fileId, userId: user.id });

    // ============= GET FILE RECORD =============
    const { data: fileRecord, error: fileError } = await supabase
      .from("course_files")
      .select("*")
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

    // Check current status - only proceed if status allows
    const allowedStatuses = ['pending', 'failed', 'manual_required', 'empty'];
    if (!allowedStatuses.includes(fileRecord.extraction_status)) {
      if (fileRecord.extraction_status === 'extracting') {
        return new Response(
          JSON.stringify({ 
            message: "Extraction already in progress",
            status: "in_progress" 
          }),
          { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (fileRecord.extraction_status === 'extracted') {
        return new Response(
          JSON.stringify({ 
            message: "Already extracted",
            status: "extracted",
            extraction_run_id: fileRecord.extraction_run_id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate new extraction run ID
    const extractionRunId = crypto.randomUUID();

    // Atomic update with lock
    const { data: updatedRecords, error: lockError } = await supabase
      .from("course_files")
      .update({ 
        extraction_status: "extracting",
        extraction_run_id: extractionRunId,
      })
      .eq("id", fileId)
      .eq("user_id", user.id)
      .in("extraction_status", allowedStatuses)
      .select();

    if (lockError || !updatedRecords || updatedRecords.length === 0) {
      log("Failed to acquire lock", { lockError });
      return new Response(
        JSON.stringify({ 
          message: "Could not start extraction - file may already be processing",
          status: "lock_failed" 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Lock acquired", { extractionRunId });

    // ============= FILE SIZE VALIDATION =============
    const fileSizeBytes = fileRecord.file_size || 0;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "file_too_large",
          extraction_metadata: { 
            error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit`,
            file_size_mb: fileSizeMB.toFixed(2)
          }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false,
          status: "file_too_large",
          message: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum: ${MAX_FILE_SIZE_MB}MB.`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= PATH VALIDATION =============
    const expectedPathPrefix = `${user.id}/`;
    if (!fileRecord.file_path.startsWith(expectedPathPrefix)) {
      log("Invalid file path", { filePath: fileRecord.file_path });
      await supabase
        .from("course_files")
        .update({ extraction_status: "failed" })
        .eq("id", fileId);
      
      return new Response(
        JSON.stringify({ error: "Access denied - invalid file path" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= CHECK FILE TYPE =============
    const mediaType = fileRecord.mime_type || "application/pdf";
    const isPDF = mediaType === "application/pdf";

    // For PDFs: Client should handle extraction (this is a fallback)
    // Mark as pending for client-side extraction
    if (isPDF) {
      log("PDF detected - expecting client-side extraction", { fileId, mediaType });
      
      // Reset to pending for client to handle
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "pending",
          extraction_metadata: {
            note: "PDF files are extracted client-side using pdf.js",
            extraction_run_id: extractionRunId,
          }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: true,
          status: "pending",
          message: "PDF ready for client-side extraction",
          extraction_run_id: extractionRunId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= IMAGE EXTRACTION VIA AI VISION =============
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedImageTypes.includes(mediaType)) {
      log("Unsupported file format", { fileId, mediaType });
      
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "unsupported_format",
          extraction_metadata: { unsupported_type: mediaType }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false,
          status: "unsupported_format",
          message: `Unsupported file type: ${mediaType}. Please upload a PDF or image.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("course-files")
      .download(fileRecord.file_path);

    if (downloadError || !fileData) {
      log("Download error", { downloadError });
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "failed",
          extraction_metadata: { error: "Failed to download file" }
        })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Downloaded file", { size: fileData.size, type: mediaType });

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    }
    const base64Data = arrayBufferToBase64(arrayBuffer);

    log("Calling AI Vision for image", { mediaType, base64Length: base64Data.length });

    const systemPrompt = `You are a document analyzer for academic course materials.
Extract the course structure, including:
1. Course title and description
2. All topic headings, chapter names, and section titles
3. Learning objectives if present
4. Any numbered or bulleted lists of subjects to cover

RULES:
- Focus on extracting the STRUCTURE and TOPICS, not full text
- Preserve numbering and hierarchy
- Mark unclear sections with [unclear]
- If this appears to be a table of contents, extract all entries
- Output in a structured format with clear headings

Do not summarize or paraphrase topic names - extract them exactly.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the course structure and topics from this document image: ${fileRecord.file_name}`
              },
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${base64Data}` }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log("AI Vision error", { status: aiResponse.status, error: errorText });
      
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

      await supabase
        .from("course_files")
        .update({ extraction_status: "manual_required" })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "AI extraction failed. Please paste text manually.",
          status: "manual_required"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || "";
    const processingTimeMs = Date.now() - startTime;

    log("AI extraction complete", { characters: extractedText.length, processingTimeMs });

    // Determine quality
    let extractionQuality: 'high' | 'medium' | 'low' | 'failed' = 'medium';
    if (extractedText.length > 2000) extractionQuality = 'high';
    else if (extractedText.length > 500) extractionQuality = 'medium';
    else if (extractedText.length > 50) extractionQuality = 'low';
    else extractionQuality = 'failed';

    if (!extractedText || extractedText.length < 10) {
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "empty",
          extracted_text: null,
          extraction_quality: 'failed',
          extraction_method: 'ai_vision',
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Could not extract text from document.",
          status: "empty"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save extracted text
    await supabase
      .from("course_files")
      .update({ 
        extraction_status: "extracted",
        extracted_text: extractedText.substring(0, 100000),
        extraction_method: 'ai_vision',
        extraction_quality: extractionQuality,
        extraction_metadata: {
          model: 'google/gemini-2.5-flash',
          characters_extracted: extractedText.length,
          processing_time_ms: processingTimeMs,
        }
      })
      .eq("id", fileId);

    log("Saved extracted text", { fileId, characters: extractedText.length, quality: extractionQuality });

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "extracted",
        message: "Text extracted successfully.",
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
