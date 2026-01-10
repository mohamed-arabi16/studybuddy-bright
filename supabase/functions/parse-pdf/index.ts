import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    console.log(`[parse-pdf] Processing file ${fileId} for user ${user.id}`);

    // Get file record
    const { data: fileRecord, error: fileError } = await supabase
      .from("course_files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .single();

    if (fileError || !fileRecord) {
      console.error("[parse-pdf] File not found:", fileError);
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to extracting
    await supabase
      .from("course_files")
      .update({ extraction_status: "extracting" })
      .eq("id", fileId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("course-files")
      .download(fileRecord.file_path);

    if (downloadError || !fileData) {
      console.error("[parse-pdf] Download error:", downloadError);
      await supabase
        .from("course_files")
        .update({ extraction_status: "failed" })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[parse-pdf] Downloaded file, size: ${fileData.size} bytes, type: ${fileRecord.mime_type}`);

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
    let mediaType = fileRecord.mime_type || "application/pdf";
    if (mediaType === "application/pdf") {
      // For PDFs, we'll use a different approach - convert first page to image or extract text
      // Using AI to describe/extract text from PDF is complex, let's use gemini with document understanding
      mediaType = "application/pdf";
    }

    console.log(`[parse-pdf] Using AI Vision to extract text from ${mediaType}`);

    // Use Gemini's document understanding capability via Lovable AI Gateway
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
            content: `You are a document text extraction AI. Extract ALL text content from the provided document.
            
RULES:
1. Extract ALL text exactly as written - do not summarize or paraphrase
2. Preserve the structure (headings, lists, paragraphs)
3. If it's a syllabus, course outline, or study material, extract topics and their descriptions
4. Output ONLY the extracted text, no commentary
5. If text is unclear or partially visible, include it with [unclear] marker
6. Preserve numbering and bullet points`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all text from this document. This appears to be a ${fileRecord.file_name} file.`
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
      console.error("[parse-pdf] AI Vision error:", aiResponse.status, errorText);
      
      // Check for rate limit or credit issues
      if (aiResponse.status === 429) {
        await supabase
          .from("course_files")
          .update({ extraction_status: "failed" })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        await supabase
          .from("course_files")
          .update({ extraction_status: "failed" })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: Mark for manual input
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "manual_required",
          extracted_text: null 
        })
        .eq("id", fileId);

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

    console.log(`[parse-pdf] AI extraction complete, extracted ${extractedText.length} characters`);

    if (!extractedText || extractedText.length < 10) {
      await supabase
        .from("course_files")
        .update({ 
          extraction_status: "empty",
          extracted_text: null 
        })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Could not extract text from document. The file may be image-based or empty." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save extracted text
    await supabase
      .from("course_files")
      .update({ 
        extraction_status: "extracted",
        extracted_text: extractedText.substring(0, 100000) // Limit to 100k chars
      })
      .eq("id", fileId);

    console.log(`[parse-pdf] Successfully extracted and saved text for file ${fileId}`);

    // Automatically call extract-topics to create topics from the extracted text
    console.log(`[parse-pdf] Triggering topic extraction for course ${fileRecord.course_id}`);
    
    try {
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-topics`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: fileRecord.course_id,
          text: extractedText,
          fileId: fileId,
        }),
      });

      if (extractResponse.ok) {
        const extractResult = await extractResponse.json();
        console.log(`[parse-pdf] Topics extracted successfully:`, extractResult);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Text extracted and topics created successfully",
            characters: extractedText.length,
            topics_count: extractResult.topics_count || 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorText = await extractResponse.text();
        console.error(`[parse-pdf] Topic extraction failed:`, errorText);
        // Still return success for PDF extraction, just note that topics weren't created
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Text extracted. Topic extraction pending - refresh to see topics.",
            characters: extractedText.length,
            topics_pending: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (extractError) {
      console.error(`[parse-pdf] Topic extraction error:`, extractError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Text extracted successfully. Topics will be created when you click 'Extract Topics'.",
          characters: extractedText.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("[parse-pdf] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
