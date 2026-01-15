/**
 * Public Health Check Endpoint - /healthz
 * 
 * PHASE 4: MONITORING & ALERTING READINESS
 * 
 * This is a safe public endpoint that provides system health status
 * without exposing secrets or user data. Designed for:
 * - Uptime monitoring services (UptimeRobot, BetterUptime, Pingdom)
 * - Load balancer health checks
 * - Kubernetes/container orchestration liveness probes
 * 
 * Security notes:
 * - NO authentication required (public endpoint)
 * - NO secrets or sensitive data exposed
 * - NO user data accessed
 * - Only returns aggregate health status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: { status: string; latency_ms: number };
    ai_gateway: { status: string; latency_ms: number };
    storage: { status: string };
  };
  uptime_seconds?: number;
}

// Track function start time for uptime calculation
const startTime = Date.now();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests for health checks
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks: {
      database: { status: "unknown", latency_ms: 0 },
      ai_gateway: { status: "unknown", latency_ms: 0 },
      storage: { status: "unknown" },
    },
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  };

  let overallHealthy = true;
  let hasDegraded = false;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      healthStatus.status = "unhealthy";
      healthStatus.checks.database.status = "misconfigured";
      return new Response(JSON.stringify(healthStatus), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Database connectivity check (simple ping-like query)
    const dbStart = Date.now();
    try {
      // Use a simple, low-cost query that doesn't expose data
      const { error: dbError } = await supabase
        .from("plans")
        .select("id")
        .limit(1);

      healthStatus.checks.database.latency_ms = Date.now() - dbStart;

      if (dbError) {
        healthStatus.checks.database.status = "error";
        overallHealthy = false;
      } else {
        healthStatus.checks.database.status = "connected";
      }
    } catch (dbException) {
      healthStatus.checks.database.status = "unreachable";
      healthStatus.checks.database.latency_ms = Date.now() - dbStart;
      overallHealthy = false;
    }

    // 2. AI Gateway health check (check recent job success rate - no AI call)
    const aiStart = Date.now();
    try {
      // Check last 10 AI jobs for success rate (proxy for AI gateway health)
      const { data: recentJobs, error: aiError } = await supabase
        .from("ai_jobs")
        .select("status")
        .order("created_at", { ascending: false })
        .limit(10);

      healthStatus.checks.ai_gateway.latency_ms = Date.now() - aiStart;

      if (aiError) {
        healthStatus.checks.ai_gateway.status = "query_error";
        hasDegraded = true;
      } else if (!recentJobs || recentJobs.length === 0) {
        healthStatus.checks.ai_gateway.status = "no_data";
        // No recent jobs is not necessarily unhealthy
      } else {
        const failedCount = recentJobs.filter(j => j.status === "failed").length;
        const failureRate = failedCount / recentJobs.length;

        if (failureRate >= 0.8) {
          healthStatus.checks.ai_gateway.status = "degraded_high_failure_rate";
          hasDegraded = true;
        } else if (failureRate >= 0.5) {
          healthStatus.checks.ai_gateway.status = "degraded";
          hasDegraded = true;
        } else {
          healthStatus.checks.ai_gateway.status = "operational";
        }
      }
    } catch (aiException) {
      healthStatus.checks.ai_gateway.status = "check_failed";
      healthStatus.checks.ai_gateway.latency_ms = Date.now() - aiStart;
      hasDegraded = true;
    }

    // 3. Storage availability check (bucket existence, no file access)
    try {
      const { data: buckets, error: storageError } = await supabase
        .storage
        .listBuckets();

      if (storageError) {
        healthStatus.checks.storage.status = "error";
        hasDegraded = true;
      } else {
        const hasCourseFilesBucket = buckets?.some(b => b.name === "course-files");
        healthStatus.checks.storage.status = hasCourseFilesBucket ? "available" : "bucket_missing";
        if (!hasCourseFilesBucket) {
          hasDegraded = true;
        }
      }
    } catch (storageException) {
      healthStatus.checks.storage.status = "unreachable";
      hasDegraded = true;
    }

    // Determine overall status
    if (!overallHealthy) {
      healthStatus.status = "unhealthy";
    } else if (hasDegraded) {
      healthStatus.status = "degraded";
    } else {
      healthStatus.status = "healthy";
    }

    // Return appropriate HTTP status code
    const httpStatus = healthStatus.status === "healthy" ? 200 
      : healthStatus.status === "degraded" ? 200 
      : 503;

    return new Response(JSON.stringify(healthStatus), {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Health check fatal error:", error);
    healthStatus.status = "unhealthy";
    healthStatus.checks.database.status = "exception";

    return new Response(JSON.stringify(healthStatus), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
