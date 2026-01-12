/**
 * Rate limiting utility for Edge Functions
 * Uses in-database tracking for distributed rate limiting
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  requests: number;      // Maximum requests allowed
  windowSeconds: number; // Time window in seconds
  keyPrefix: string;     // Prefix for the rate limit key
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until rate limit resets
}

/**
 * Default rate limits for different endpoints
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'extract-topics': { requests: 10, windowSeconds: 3600, keyPrefix: 'rl:extract-topics' },
  'generate-unified-plan': { requests: 20, windowSeconds: 3600, keyPrefix: 'rl:generate-plan' },
  'parse-pdf': { requests: 30, windowSeconds: 3600, keyPrefix: 'rl:parse-pdf' },
  'ocr-pages': { requests: 20, windowSeconds: 3600, keyPrefix: 'rl:ocr-pages' },
  'check-quota': { requests: 100, windowSeconds: 60, keyPrefix: 'rl:check-quota' },
  'default': { requests: 60, windowSeconds: 60, keyPrefix: 'rl:default' },
};

/**
 * Check rate limit for a user on a specific endpoint
 * Uses the ai_jobs table to track requests (since it already exists)
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const limits = config || RATE_LIMITS[endpoint] || RATE_LIMITS['default'];
  const windowStart = new Date(Date.now() - limits.windowSeconds * 1000);
  
  try {
    // Count recent requests for this user and endpoint type
    const { count, error } = await supabase
      .from('ai_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('job_type', endpoint)
      .gte('created_at', windowStart.toISOString());
    
    if (error) {
      // On error, be permissive but log the issue
      console.error('[rate-limit] Error checking rate limit:', error);
      return {
        allowed: true,
        remaining: limits.requests,
        resetAt: new Date(Date.now() + limits.windowSeconds * 1000),
      };
    }
    
    const currentCount = count || 0;
    const remaining = Math.max(0, limits.requests - currentCount);
    const resetAt = new Date(windowStart.getTime() + limits.windowSeconds * 1000);
    
    if (currentCount >= limits.requests) {
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }
    
    return {
      allowed: true,
      remaining: remaining - 1, // Account for the current request
      resetAt,
    };
  } catch (error) {
    // On unexpected error, be permissive
    console.error('[rate-limit] Unexpected error:', error);
    return {
      allowed: true,
      remaining: limits.requests,
      resetAt: new Date(Date.now() + limits.windowSeconds * 1000),
    };
  }
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    'Retry-After': (result.retryAfter || 60).toString(),
  };

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retry_after: result.retryAfter,
      reset_at: result.resetAt.toISOString(),
    }),
    { status: 429, headers }
  );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: Response, 
  result: RateLimitResult
): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-RateLimit-Remaining', result.remaining.toString());
  newHeaders.set('X-RateLimit-Reset', result.resetAt.toISOString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
