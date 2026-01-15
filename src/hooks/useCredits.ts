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
        // No credit record yet - user hasn't made any AI calls
        // Set default based on subscription (will be created on first AI call)
        setCredits({
          balance: 50, // Default free tier
          monthlyAllowance: 50,
          lastResetDate: new Date().toISOString(),
          planTier: 'free',
        });
      }

      // Fetch credit costs
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
