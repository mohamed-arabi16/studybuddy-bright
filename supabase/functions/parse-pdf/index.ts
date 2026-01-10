import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { fileId } = await req.json();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "fileId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Processing file", { fileId, userId: user.id });

    // ============= P0: ATOMIC LOCKING =============
    // Get file record and atomically lock it
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
      // Already processing or completed
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

    // P0 FIX: Atomic update with .select() and array length check (not .single() which throws on 0 rows)
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

    // Check if any rows were updated (atomic check)
    if (lockError || !updatedRecords || updatedRecords.length === 0) {
      log("Failed to acquire lock - status may have changed", { lockError });
      return new Response(
        JSON.stringify({ 
          message: "Could not start extraction - file may already be processing",
          status: "lock_failed" 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updated = updatedRecords[0];

    log("Lock acquired", { extractionRunId });

    // ============= P0: FILE SIZE VALIDATION =============
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
          message: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum: ${MAX_FILE_SIZE_MB}MB. Please paste text manually.`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= P0: PATH VALIDATION FOR STORAGE =============
    const expectedPathPrefix = `${user.id}/`;
    if (!fileRecord.file_path.startsWith(expectedPathPrefix)) {
      log("Invalid file path", { filePath: fileRecord.file_path, expectedPrefix: expectedPathPrefix });
      await supabase
        .from("course_files")
        .update({ extraction_status: "failed" })
        .eq("id", fileId);
      
      return new Response(
        JSON.stringify({ error: "Access denied - invalid file path" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          extraction_metadata: { error: "Failed to download file from storage" }
        })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Downloaded file", { size: fileData.size, type: fileRecord.mime_type });

    // Convert file to base64 for AI Vision using chunked approach for large files
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Chunked base64 encoding to avoid stack overflow for large files
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192; // Process in 8KB chunks
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    }
    
    const base64Data = arrayBufferToBase64(arrayBuffer);
    
    // Determine media type
    const mediaType = fileRecord.mime_type || "application/pdf";

    // ============= P0 FIX: STOP USING image_url FOR PDFs =============
    // PDFs are not reliably handled by vision APIs as images
    // Mark for manual input until we add proper PDF text extraction
    const isPDF = mediaType === "application/pdf";
    
    if (isPDF) {
      log("PDF detected - marking for manual input", { fileId, mediaType });
      
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "manual_required",
          extraction_metadata: {
            reason: "PDF files require manual text input for reliable extraction",
            file_type: mediaType,
            extraction_run_id: extractionRunId,
          }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false,
          status: "manual_required",
          message: "PDF files currently require manual text input. Please paste your syllabus content in the text field.",
          extraction_run_id: extractionRunId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process images with vision API
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedImageTypes.includes(mediaType)) {
      log("Unsupported file format", { fileId, mediaType });
      
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "unsupported_format",
          extraction_metadata: { 
            unsupported_type: mediaType,
            extraction_run_id: extractionRunId,
          }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false,
          status: "unsupported_format",
          message: `Unsupported file type: ${mediaType}. Please upload an image or paste text manually.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Calling AI Vision for image", { mediaType, base64Length: base64Data.length });

    // ============= P1: UPDATED PROMPT FOR STRUCTURE/TOPICS =============
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

Do not summarize or paraphrase topic names - extract them exactly.
If text is partially visible or unclear, include it with [unclear] marker.`;

    // Use Gemini's document understanding capability via Lovable AI Gateway (images only)
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
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the course structure and topics from this document image: ${fileRecord.file_name}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log("AI Vision error", { status: aiResponse.status, error: errorText });
      
      // Categorize error
      let extractionStatus = "failed";
      let errorMessage = "AI extraction failed";
      
      if (aiResponse.status === 429) {
        extractionStatus = "rate_limited";
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (aiResponse.status === 402) {
        extractionStatus = "failed";
        errorMessage = "AI credits exhausted.";
      }
      
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: extractionStatus === "rate_limited" ? "failed" : "manual_required",
          extraction_metadata: { error: errorMessage, ai_status: aiResponse.status }
        })
        .eq("id", fileId);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: Mark for manual input
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "AI extraction failed. Please paste syllabus text manually.",
          status: "manual_required"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || "";
    const processingTimeMs = Date.now() - startTime;

    log("AI extraction complete", { characters: extractedText.length, processingTimeMs });

    // ============= P1: DETERMINE EXTRACTION QUALITY =============
    let extractionQuality: 'high' | 'medium' | 'low' | 'failed' = 'medium';
    if (extractedText.length > 2000) {
      extractionQuality = 'high';
    } else if (extractedText.length > 500) {
      extractionQuality = 'medium';
    } else if (extractedText.length > 50) {
      extractionQuality = 'low';
    } else {
      extractionQuality = 'failed';
    }

    if (!extractedText || extractedText.length < 10) {
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "empty",
          extracted_text: null,
          extraction_quality: 'failed',
          extraction_method: 'ai_vision',
          extraction_metadata: {
            model: 'google/gemini-2.5-flash',
            processing_time_ms: processingTimeMs,
            characters_extracted: 0,
          }
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Could not extract text from document. The file may be image-based or empty.",
          status: "empty"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= SAVE EXTRACTED TEXT WITH METADATA =============
    await supabase
      .from("course_files")
      .update({ 
        extraction_status: "extracted",
        extracted_text: extractedText.substring(0, 100000), // Limit to 100k chars
        extraction_method: 'ai_vision',
        extraction_quality: extractionQuality,
        extraction_metadata: {
          model: 'google/gemini-2.5-flash',
          characters_extracted: extractedText.length,
          processing_time_ms: processingTimeMs,
          file_size_bytes: fileSizeBytes,
        }
      })
      .eq("id", fileId);

    log("Saved extracted text", { 
      fileId, 
      characters: extractedText.length, 
      quality: extractionQuality,
      extractionRunId 
    });

    // ============= P1: DECOUPLED FROM extract-topics =============
    // Return immediately - client will trigger topic extraction separately
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "extracted",
        message: "Text extracted successfully. Click 'Extract Topics' to create topics from this content.",
        characters: extractedText.length,
        extraction_quality: extractionQuality,
        extraction_run_id: extractionRunId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    log("Error", { message: error instanceof Error ? error.message : "Unknown error" });
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
