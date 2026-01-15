import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CreditsState {
  balance: number;
  monthlyAllowance: number;
  resetDate: Date;
  planTier: string;
}

export interface CreditCost {
  action_type: string;
  cost_credits: number;
  description: string | null;
}

export function useCredits() {
  const [credits, setCredits] = useState<CreditsState | null>(null);
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getNextResetDate = (lastResetDate: string): Date => {
    const lastReset = new Date(lastResetDate);
    const nextReset = new Date(lastReset);
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    return nextReset;
  };

  const fetchCredits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch user credits
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .select('balance, monthly_allowance, last_reset_date, plan_tier')
        .eq('user_id', user.id)
        .single();

      if (creditError && creditError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine for new users
        console.error('[useCredits] Error fetching credits:', creditError);
      }

      if (creditData) {
        setCredits({
          balance: creditData.balance,
          monthlyAllowance: creditData.monthly_allowance,
          resetDate: getNextResetDate(creditData.last_reset_date),
          planTier: creditData.plan_tier,
        });
      } else {
        // User doesn't have credits yet, use defaults
        // Credits will be initialized on first AI action
        setCredits({
          balance: 50,
          monthlyAllowance: 50,
          resetDate: getNextResetDate(new Date().toISOString()),
          planTier: 'free',
        });
      }

      // Fetch credit costs for action buttons
      const { data: costsData } = await supabase
        .from('credit_costs')
        .select('action_type, cost_credits, description')
        .eq('is_active', true);

      if (costsData) {
        setCosts(costsData);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('[useCredits] Unexpected error:', error);
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // Helper to get cost for a specific action
  const getCost = useCallback((actionType: string): number => {
    const cost = costs.find(c => c.action_type === actionType);
    // Default costs if not found
    const defaults: Record<string, number> = {
      extract_topics: 30,
      generate_plan: 15,
      analyze_topic: 5,
      chat_with_tutor: 2,
    };
    return cost?.cost_credits ?? defaults[actionType] ?? 10;
  }, [costs]);

  // Check if user can afford an action
  const canAfford = useCallback((actionType: string): boolean => {
    if (!credits) return false;
    return credits.balance >= getCost(actionType);
  }, [credits, getCost]);

  // Calculate percentage for progress display
  const percentage = credits 
    ? Math.min(100, Math.max(0, (credits.balance / credits.monthlyAllowance) * 100))
    : 0;

  const isLow = percentage <= 20;
  const isExhausted = credits?.balance === 0;

  return { 
    credits, 
    costs,
    isLoading, 
    refresh: fetchCredits,
    getCost,
    canAfford,
    percentage,
    isLow,
    isExhausted,
  };
}
