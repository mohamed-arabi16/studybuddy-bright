import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreditState {
  balance: number;
  monthlyAllowance: number;
  lastResetDate: string;
  planTier: 'free' | 'trial' | 'pro';
}

interface CreditCost {
  action_type: string;
  cost_credits: number;
}

interface UseCreditsReturn {
  credits: CreditState | null;
  costs: CreditCost[];
  isLoading: boolean;
  error: string | null;
  getCost: (actionType: string) => number;
  canAfford: (actionType: string) => boolean;
  getUsedCredits: () => number;
  getResetDate: () => Date;
  refresh: () => Promise<void>;
}

// Default costs as fallback
const DEFAULT_COSTS: Record<string, number> = {
  extract_topics: 30,
  generate_plan: 15,
  analyze_topic: 5,
  chat_with_tutor: 2,
};

// Default allowances from credit_plans table (fallback values)
const DEFAULT_ALLOWANCES: Record<string, number> = {
  free: 50,
  trial: 1500,
  pro: 1500,
};

export function useCredits(): UseCreditsReturn {
  const [credits, setCredits] = useState<CreditState | null>(null);
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCredits(null);
        setIsLoading(false);
        return;
      }

      // Fetch user credits
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .select('balance, monthly_allowance, last_reset_date, plan_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (creditError) {
        console.error('[useCredits] Error fetching credits:', creditError);
        setError('Failed to load credits');
      } else if (creditData) {
        setCredits({
          balance: creditData.balance,
          monthlyAllowance: creditData.monthly_allowance,
          lastResetDate: creditData.last_reset_date,
          planTier: creditData.plan_tier as 'free' | 'trial' | 'pro',
        });
        setError(null);
      } else {
        // No credit record yet - determine plan tier from subscription
        // This will be auto-created on first AI call via consume_credits()
        const [subResult, overrideResult, creditPlansResult] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('status, trial_end, plans(name)')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('admin_overrides')
            .select('quota_overrides')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('credit_plans')
            .select('tier, monthly_allowance')
            .eq('is_active', true),
        ]);

        // Build allowance map from DB
        const allowanceMap: Record<string, number> = { ...DEFAULT_ALLOWANCES };
        if (creditPlansResult.data) {
          for (const plan of creditPlansResult.data) {
            allowanceMap[plan.tier] = plan.monthly_allowance;
          }
        }

        // Determine tier from subscription/overrides
        let tier: 'free' | 'trial' | 'pro' = 'free';
        
        // Check admin override first
        const quotaOverrides = overrideResult.data?.quota_overrides as { courses?: number } | null;
        if (quotaOverrides?.courses === -1) {
          tier = 'pro';
        } else if (subResult.data) {
          const sub = subResult.data;
          const planName = (sub.plans as { name: string } | null)?.name?.toLowerCase() || '';
          
          if (sub.status === 'active' && planName.includes('pro')) {
            tier = 'pro';
          } else if (sub.status === 'trialing' && sub.trial_end) {
            const trialEnd = new Date(sub.trial_end);
            if (trialEnd > new Date()) {
              tier = 'trial';
            }
          }
        }

        const allowance = allowanceMap[tier] ?? 50;
        
        setCredits({
          balance: allowance, // Full balance since no usage yet
          monthlyAllowance: allowance,
          lastResetDate: new Date().toISOString(),
          planTier: tier,
        });
        setError(null);
      }

      // Fetch credit costs from DB
      const { data: costsData, error: costsError } = await supabase
        .from('credit_costs')
        .select('action_type, cost_credits')
        .eq('is_active', true);

      if (costsError) {
        console.error('[useCredits] Error fetching costs:', costsError);
      } else if (costsData) {
        setCosts(costsData);
      }

    } catch (err) {
      console.error('[useCredits] Unexpected error:', err);
      setError('Failed to load credit data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // Get cost for a specific action
  const getCost = useCallback((actionType: string): number => {
    const costEntry = costs.find(c => c.action_type === actionType);
    return costEntry?.cost_credits ?? DEFAULT_COSTS[actionType] ?? 10;
  }, [costs]);

  // Check if user can afford an action
  const canAfford = useCallback((actionType: string): boolean => {
    if (!credits) return false;
    const cost = getCost(actionType);
    return credits.balance >= cost;
  }, [credits, getCost]);

  // Get used credits (allowance - balance)
  const getUsedCredits = useCallback((): number => {
    if (!credits) return 0;
    return credits.monthlyAllowance - credits.balance;
  }, [credits]);

  // Get next reset date (start of next month)
  const getResetDate = useCallback((): Date => {
    if (!credits?.lastResetDate) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    const lastReset = new Date(credits.lastResetDate);
    return new Date(lastReset.getFullYear(), lastReset.getMonth() + 1, 1);
  }, [credits]);

  return {
    credits,
    costs,
    isLoading,
    error,
    getCost,
    canAfford,
    getUsedCredits,
    getResetDate,
    refresh: fetchCredits,
  };
}
