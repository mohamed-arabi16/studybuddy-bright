// Phase 2: Credit System Shared Utilities
// Provides atomic credit consumption and token tracking for AI operations

// Note: This module uses untyped Supabase client from edge functions
// The new tables (credit_costs, user_credits, credit_usage_events) are accessed via raw queries

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

export interface CreditResult {
  success: boolean;
  error?: string;
  balance?: number;
  required?: number;
  monthly_allowance?: number;
  plan_tier?: string;
  event_id?: string;
  credits_charged?: number;
}

// Default costs as fallback (should match DB seed values)
const DEFAULT_COSTS: Record<string, number> = {
  extract_topics: 30,
  generate_plan: 15,
  analyze_topic: 5,
  chat_with_tutor: 2,
};

// Generic supabase client type for edge functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Get the credit cost for an action from the database
 */
export async function getActionCost(
  supabase: SupabaseClient,
  actionType: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('credit_costs')
      .select('cost_credits')
      .eq('action_type', actionType)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.log(`[credits] No cost found for ${actionType}, using default`);
      return DEFAULT_COSTS[actionType] ?? 10;
    }

    return (data as { cost_credits: number }).cost_credits;
  } catch (err) {
    console.error(`[credits] Error fetching cost for ${actionType}:`, err);
    return DEFAULT_COSTS[actionType] ?? 10;
  }
}

/**
 * Consume credits atomically before an AI operation
 * Returns success/failure with balance info
 */
export async function consumeCredits(
  supabase: SupabaseClient,
  userId: string,
  actionType: string,
  jobId?: string | null,
  courseId?: string | null
): Promise<CreditResult> {
  try {
    // Get the cost for this action
    const cost = await getActionCost(supabase, actionType);
    
    console.log(`[credits] Consuming ${cost} credits for ${actionType} (user: ${userId})`);

    // Call the atomic consume_credits function using raw RPC
    const { data, error } = await supabase.rpc('consume_credits', {
      p_user_id: userId,
      p_amount: cost,
      p_action: actionType,
      p_job_id: jobId || null,
      p_course_id: courseId || null,
    });

    if (error) {
      console.error('[credits] RPC error:', error);
      return {
        success: false,
        error: 'CREDIT_SYSTEM_ERROR',
        balance: 0,
        required: cost,
      };
    }

    // Parse the JSONB response
    const result = data as CreditResult;
    
    if (!result || !result.success) {
      console.log(`[credits] Insufficient credits: have ${result?.balance}, need ${result?.required}`);
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        balance: result?.balance,
        required: result?.required,
        monthly_allowance: result?.monthly_allowance,
        plan_tier: result?.plan_tier,
      };
    }

    console.log(`[credits] Success: charged ${result.credits_charged}, new balance: ${result.balance}`);
    return {
      success: true,
      balance: result.balance,
      credits_charged: result.credits_charged,
      monthly_allowance: result.monthly_allowance,
      plan_tier: result.plan_tier,
      event_id: result.event_id,
    };

  } catch (err) {
    console.error('[credits] Unexpected error:', err);
    return {
      success: false,
      error: 'CREDIT_SYSTEM_ERROR',
    };
  }
}

/**
 * Update token usage after an AI call completes
 * Used for cost modeling and analytics
 */
export async function updateTokenUsage(
  supabase: SupabaseClient,
  eventId: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
  model?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_credit_usage_tokens', {
      p_event_id: eventId,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_latency_ms: latencyMs,
      p_model: model || null,
      p_metadata: metadata || null,
    });

    if (error) {
      console.error('[credits] Failed to update token usage:', error);
    } else {
      console.log(`[credits] Token usage recorded: ${tokensIn} in, ${tokensOut} out, ${latencyMs}ms`);
    }
  } catch (err) {
    console.error('[credits] Error updating token usage:', err);
  }
}

/**
 * Create a standardized insufficient credits response
 */
export function createInsufficientCreditsResponse(
  balance: number,
  required: number,
  planTier?: string
): Response {
  return new Response(
    JSON.stringify({
      error: 'INSUFFICIENT_CREDITS',
      message: `Not enough credits. You have ${balance} credits, but this action requires ${required}.`,
      balance,
      required,
      plan_tier: planTier,
      upgrade_url: '/app/settings',
    }),
    {
      status: 402,
      headers: corsHeaders,
    }
  );
}
