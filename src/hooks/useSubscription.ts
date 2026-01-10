import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PlanLimits = {
  courses: number;
  topics_per_course: number;
  ai_extractions: number;
};

export type SubscriptionStatus = {
  planName: string;
  status: string;
  limits: PlanLimits;
  usage: {
    courses: number;
  };
  isLoading: boolean;
  isTrial: boolean;
  isPro: boolean;
  subscriptionEnd: string | null;
  billingCycle: string | null;
};

const FREE_LIMITS: PlanLimits = {
  courses: 2,
  topics_per_course: 10,
  ai_extractions: 3
};

const PRO_LIMITS: PlanLimits = {
  courses: -1, // unlimited
  topics_per_course: -1, // unlimited
  ai_extractions: 50
};

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    planName: 'Free',
    status: 'trialing',
    limits: FREE_LIMITS,
    usage: { courses: 0 },
    isLoading: true,
    isTrial: true,
    isPro: false,
    subscriptionEnd: null,
    billingCycle: null,
  });

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Get course count for usage
      const { count: courseCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'archived');

      // ALWAYS check admin_overrides first - this takes priority
      const { data: overrideData } = await supabase
        .from('admin_overrides')
        .select('quota_overrides, trial_extension_days, notes')
        .eq('user_id', user.id)
        .maybeSingle();

      const quotaOverrides = (overrideData?.quota_overrides ?? null) as Partial<PlanLimits> | null;
      const hasQuotaOverrides = !!quotaOverrides && Object.keys(quotaOverrides).length > 0;

      // 1) Admin quota overrides (e.g., grant Pro via unlimited courses)
      if (hasQuotaOverrides) {
        // Check if override grants Pro-level (courses: -1 means unlimited)
        if (quotaOverrides.courses === -1) {
          setStatus({
            planName: 'Pro',
            status: 'active',
            limits: { ...PRO_LIMITS, ...quotaOverrides },
            usage: { courses: courseCount || 0 },
            isLoading: false,
            isTrial: false,
            isPro: true,
            subscriptionEnd: null,
            billingCycle: null,
          });
          return;
        }

        // Partial override - apply limits on top of free
        const mergedLimits = { ...FREE_LIMITS, ...quotaOverrides };
        setStatus({
          planName: 'Free+',
          status: 'active',
          limits: mergedLimits,
          usage: { courses: courseCount || 0 },
          isLoading: false,
          isTrial: false,
          isPro: false,
          subscriptionEnd: null,
          billingCycle: null,
        });
        return;
      }

      // 2) Admin trial extensions (treat as a Pro trial)
      const trialExtensionDays = overrideData?.trial_extension_days ?? 0;
      if (trialExtensionDays > 0) {
        const now = new Date();

        // If the user already has a trial_end in subscriptions, extend from there.
        // Otherwise, start the trial from now.
        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('trial_end')
          .eq('user_id', user.id)
          .maybeSingle();

        const baseEnd = subRow?.trial_end ? new Date(subRow.trial_end) : now;
        const trialEnd = new Date(baseEnd.getTime() + trialExtensionDays * 24 * 60 * 60 * 1000);

        setStatus({
          planName: 'Pro',
          status: 'trialing',
          limits: PRO_LIMITS,
          usage: { courses: courseCount || 0 },
          isLoading: false,
          isTrial: true,
          isPro: true,
          subscriptionEnd: trialEnd.toISOString(),
          billingCycle: null,
        });
        return;
      }

      // Check Stripe subscription
      const { data: stripeData, error: stripeError } = await supabase.functions.invoke('check-subscription');
      
      if (stripeError) {
        console.error('Error checking Stripe subscription:', stripeError);
        // Fall back to database check
        await checkDatabaseSubscription(user.id, courseCount || 0);
        return;
      }

      const isPro = stripeData?.plan === 'pro' && stripeData?.subscribed;
      
      setStatus({
        planName: isPro ? 'Pro' : 'Free',
        status: isPro ? 'active' : 'trialing',
        limits: isPro ? PRO_LIMITS : FREE_LIMITS,
        usage: {
          courses: courseCount || 0,
        },
        isLoading: false,
        isTrial: !isPro,
        isPro,
        subscriptionEnd: stripeData?.subscription_end || null,
        billingCycle: stripeData?.billing_cycle || null,
      });

    } catch (error) {
      console.error('Error fetching subscription:', error);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const checkDatabaseSubscription = async (userId: string, courseCount: number) => {
    try {
      // Fallback: check database subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plans (
            name,
            limits
          )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      let limits = FREE_LIMITS;
      let planName = 'Free';
      let subStatus = 'trialing';

      if (subData?.plans) {
        const planLimits = subData.plans.limits as PlanLimits;
        limits = planLimits || FREE_LIMITS;
        planName = subData.plans.name;
        subStatus = subData.status;
      }

      setStatus({
        planName,
        status: subStatus,
        limits,
        usage: {
          courses: courseCount,
        },
        isLoading: false,
        isTrial: subStatus === 'trialing',
        isPro: planName.toLowerCase() === 'pro',
        subscriptionEnd: null,
        billingCycle: null,
      });
    } catch (error) {
      console.error('Error checking database subscription:', error);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchSubscription();
    
    // Refresh subscription status every minute
    const interval = setInterval(fetchSubscription, 60000);
    return () => clearInterval(interval);
  }, [fetchSubscription]);

  const checkLimit = (limitKey: keyof PlanLimits, currentUsage: number) => {
    const limit = status.limits[limitKey];
    if (limit === undefined || limit === -1) return true; // No limit or unlimited
    return currentUsage < limit;
  };

  const refresh = () => {
    fetchSubscription();
  };

  return { ...status, checkLimit, refresh };
}