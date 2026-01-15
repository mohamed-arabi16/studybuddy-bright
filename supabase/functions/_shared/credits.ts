/**
 * P2 Credit System: Shared utility for consuming credits before AI operations
 * 
 * This module provides atomic credit consumption with:
 * - Database-driven costs (configurable without code deploys)
 * - Fallback defaults for resilience
 * - Integration with the consume_credits database function
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CreditResult {
  success: boolean;
  error?: string;
  balance?: number;
  required?: number;
  credits_charged?: number;
  new_balance?: number;
  plan_tier?: string;
}

// Default costs if database lookup fails
const DEFAULT_COSTS: Record<string, number> = {
  extract_topics: 30,
  generate_plan: 15,
  analyze_topic: 5,
  chat_with_tutor: 2,
};

/**
 * Consume credits before performing an AI operation
 * 
 * @param supabase - Supabase client (service role)
 * @param userId - The user's ID
 * @param actionType - The type of action (e.g., 'extract_topics', 'generate_plan')
 * @param jobId - Optional AI job ID for tracking
 * @param courseId - Optional course ID for tracking
 * @returns CreditResult with success status and balance information
 */
export async function consumeCredits(
  supabase: SupabaseClient,
  userId: string,
  actionType: string,
  jobId?: string,
  courseId?: string
): Promise<CreditResult> {
  try {
    // Get action cost from DB
    const { data: costData, error: costError } = await supabase
      .from('credit_costs')
      .select('cost_credits')
      .eq('action_type', actionType)
      .eq('is_active', true)
      .single();

    if (costError) {
      console.log(`[credits] Cost lookup failed for ${actionType}, using default:`, costError.message);
    }

    const cost = costData?.cost_credits ?? DEFAULT_COSTS[actionType] ?? 10;

    // Call atomic consume function
    const { data, error } = await supabase.rpc('consume_credits', {
      p_user_id: userId,
      p_amount: cost,
      p_action: actionType,
      p_job_id: jobId || null,
      p_course_id: courseId || null
    });

    if (error) {
      console.error('[credits] consume_credits RPC error:', error);
      return {
        success: false,
        error: 'CREDIT_ERROR',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'CREDIT_ERROR',
        balance: data?.balance,
        required: data?.required,
        plan_tier: data?.plan_tier,
      };
    }

    return {
      success: true,
      credits_charged: data.credits_charged,
      new_balance: data.new_balance,
      balance: data.new_balance,
      plan_tier: data.plan_tier,
    };
  } catch (err) {
    console.error('[credits] Unexpected error:', err);
    return {
      success: false,
      error: 'CREDIT_ERROR',
    };
  }
}

/**
 * Get the cost of an action (for UI display)
 * 
 * @param supabase - Supabase client
 * @param actionType - The type of action
 * @returns The credit cost or default
 */
export async function getActionCost(
  supabase: SupabaseClient,
  actionType: string
): Promise<number> {
  try {
    const { data } = await supabase
      .from('credit_costs')
      .select('cost_credits')
      .eq('action_type', actionType)
      .eq('is_active', true)
      .single();

    return data?.cost_credits ?? DEFAULT_COSTS[actionType] ?? 10;
  } catch {
    return DEFAULT_COSTS[actionType] ?? 10;
  }
}

/**
 * Update token usage metadata for a credit usage event
 * 
 * @param supabase - Supabase client (service role)
 * @param jobId - The AI job ID
 * @param usage - Token usage from AI provider
 * @param latencyMs - Request latency in milliseconds
 */
export async function updateTokenUsage(
  supabase: SupabaseClient,
  jobId: string,
  usage: { prompt_tokens?: number; completion_tokens?: number },
  latencyMs?: number,
  model?: string
): Promise<void> {
  try {
    await supabase
      .from('credit_usage_events')
      .update({
        tokens_in: usage.prompt_tokens,
        tokens_out: usage.completion_tokens,
        latency_ms: latencyMs,
        model: model,
        provider_response_metadata: { usage }
      })
      .eq('job_id', jobId);
  } catch (err) {
    console.error('[credits] Failed to update token usage:', err);
  }
}

/**
 * Create CORS headers for insufficient credits response
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create a standardized response for insufficient credits
 */
export function createInsufficientCreditsResponse(
  creditResult: CreditResult
): Response {
  return new Response(
    JSON.stringify({
      error: 'INSUFFICIENT_CREDITS',
      message: `Not enough credits. You have ${creditResult.balance} credits, but this action requires ${creditResult.required}.`,
      balance: creditResult.balance,
      required: creditResult.required,
      plan_tier: creditResult.plan_tier,
    }),
    { 
      status: 402, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
