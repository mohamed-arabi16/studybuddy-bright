import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuthenticatedUser, isAuthError, createAuthErrorResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanLimits {
  courses: number;
  topics_total: number;
  ai_extractions: number;
}

const DEFAULT_LIMITS: PlanLimits = {
  courses: 3,
  topics_total: 50,
  ai_extractions: 3,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, courseId } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============= P0: AUTH GUARD (Zombie Session Fix) =============
    const authResult = await validateAuthenticatedUser(req, { supabaseAdmin: supabase });
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    // Get subscription and plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plans (
          name,
          limits
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    // Get admin overrides
    const { data: override } = await supabase
      .from('admin_overrides')
      .select('quota_overrides')
      .eq('user_id', user.id)
      .maybeSingle();

    // Determine effective limits
    let limits: PlanLimits = DEFAULT_LIMITS;
    let planName = 'Free';
    let isActive = true;

    if (subscription?.plans) {
      const planLimits = subscription.plans.limits as PlanLimits;
      limits = planLimits || DEFAULT_LIMITS;
      planName = subscription.plans.name;
      
      // Check if subscription is active
      if (subscription.status === 'canceled' || subscription.status === 'past_due') {
        isActive = false;
      }
      
      // Check trial expiration
      if (subscription.status === 'trialing' && subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        if (trialEnd < new Date()) {
          isActive = false;
        }
      }
    }

    // Apply overrides
    if (override?.quota_overrides) {
      limits = { ...limits, ...(override.quota_overrides as Partial<PlanLimits>) };
    }

    // Check specific action quotas
    let allowed = true;
    let message = '';
    let currentUsage = 0;
    let limit = 0;

    switch (action) {
      case 'create_course': {
        const { count } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .neq('status', 'archived');
        
        currentUsage = count || 0;
        limit = limits.courses;
        allowed = currentUsage < limit;
        message = allowed 
          ? `You can create ${limit - currentUsage} more course(s)` 
          : `Course limit reached (${limit}). Upgrade to add more courses.`;
        break;
      }

      case 'add_topic': {
        // Check total topics across all courses for the user
        const { count } = await supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        currentUsage = count || 0;
        limit = limits.topics_total;
        allowed = limit === -1 || currentUsage < limit;
        message = allowed 
          ? `You can add ${limit === -1 ? 'unlimited' : limit - currentUsage} more topic(s)` 
          : `Topic limit reached (${limit} total). Upgrade for more topics.`;
        break;
      }

      case 'ai_extraction': {
        // Count AI extractions this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count } = await supabase
          .from('ai_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('job_type', 'extract_topics')
          .gte('created_at', startOfMonth.toISOString());
        
        currentUsage = count || 0;
        limit = limits.ai_extractions;
        allowed = currentUsage < limit;
        message = allowed 
          ? `You have ${limit - currentUsage} AI extraction(s) remaining this month` 
          : `AI extraction limit reached (${limit}/month). Upgrade for more.`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({
        allowed,
        message,
        current_usage: currentUsage,
        limit,
        plan_name: planName,
        is_active: isActive,
        limits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('check-quota error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
