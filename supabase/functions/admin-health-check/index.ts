import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from '../_shared/auth-guard.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // P0 Security: Validate auth + disabled check + admin check
    const authResult = await validateAuthenticatedUser(req, { requireAdmin: true, supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    // Health checks
    const healthResults = {
      database: { status: "unknown", latency: 0 },
      ai: { status: "unknown", latency: 0 },
      storage: { status: "unknown", used: 0, available: true },
    };

    // 1. Database health check
    const dbStart = Date.now();
    try {
      const { error: dbError } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);
      
      healthResults.database = {
        status: dbError ? "error" : "connected",
        latency: Date.now() - dbStart,
      };
    } catch {
      healthResults.database = { status: "error", latency: Date.now() - dbStart };
    }

    // 2. AI Service health check (check if we have the gateway configured)
    const aiStart = Date.now();
    try {
      // Check if AI gateway is accessible by checking recent AI jobs
      const { data: recentJobs, error: aiError } = await supabase
        .from("ai_jobs")
        .select("id, status")
        .order("created_at", { ascending: false })
        .limit(5);
      
      const hasRecentErrors = recentJobs?.filter(j => j.status === "failed").length ?? 0;
      const totalRecent = recentJobs?.length ?? 0;
      
      if (aiError) {
        healthResults.ai = { status: "error", latency: Date.now() - aiStart };
      } else if (totalRecent > 0 && hasRecentErrors >= totalRecent) {
        healthResults.ai = { status: "degraded", latency: Date.now() - aiStart };
      } else {
        healthResults.ai = { status: "online", latency: Date.now() - aiStart };
      }
    } catch {
      healthResults.ai = { status: "error", latency: Date.now() - aiStart };
    }

    // 3. Storage health check
    const storageStart = Date.now();
    try {
      const { data: buckets, error: storageError } = await supabase
        .storage
        .listBuckets();
      
      if (storageError) {
        healthResults.storage = { 
          status: "error", 
          used: 0, 
          available: false 
        };
      } else {
        // Get file count from course_files table as a proxy for storage usage
        const { count: fileCount } = await supabase
          .from("course_files")
          .select("*", { count: "exact", head: true });
        
        healthResults.storage = {
          status: "available",
          used: fileCount || 0,
          available: true,
        };
      }
    } catch {
      healthResults.storage = { status: "error", used: 0, available: false };
    }

    return new Response(JSON.stringify(healthResults), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Health check error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
