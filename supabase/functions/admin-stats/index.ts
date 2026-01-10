import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get date range for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 0. Get total counts (bypasses RLS with service role)
    const [
      { count: totalUsers },
      { count: totalCourses },
      { count: totalTopics },
      { count: activeSubsCount },
      { count: trialingCount },
      { count: overrideCount },
      { count: aiJobsTodayCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('topics').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
      supabase.from('admin_overrides').select('*', { count: 'exact', head: true }),
      supabase.from('ai_jobs').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const totals = {
      users: totalUsers || 0,
      courses: totalCourses || 0,
      topics: totalTopics || 0,
      activeSubs: activeSubsCount || 0,
      trialingUsers: trialingCount || 0,
      proOverrides: overrideCount || 0,
      aiJobsToday: aiJobsTodayCount || 0,
    };

    // 1. User signups per day (last 30 days)
    const { data: signupData } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const signupsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      signupsByDay[dateStr] = 0;
    }

    signupData?.forEach((profile) => {
      const dateStr = profile.created_at.split('T')[0];
      if (signupsByDay[dateStr] !== undefined) {
        signupsByDay[dateStr]++;
      }
    });

    const dailySignups = Object.entries(signupsByDay).map(([date, count]) => ({
      date,
      signups: count,
    }));

    // 2. Top users by activity
    const { data: topUsers } = await supabase
      .from('profiles')
      .select(`
        user_id,
        email,
        display_name,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    const userStats = await Promise.all(
      (topUsers || []).map(async (profile) => {
        const [coursesResult, topicsResult, aiJobsResult] = await Promise.all([
          supabase
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.user_id),
          supabase
            .from('topics')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.user_id),
          supabase
            .from('ai_jobs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.user_id),
        ]);

        return {
          user_id: profile.user_id,
          email: profile.email,
          display_name: profile.display_name,
          joined: profile.created_at,
          courses: coursesResult.count || 0,
          topics: topicsResult.count || 0,
          ai_requests: aiJobsResult.count || 0,
        };
      })
    );

    // Sort by activity (courses + topics + ai_requests)
    userStats.sort((a, b) => {
      const activityA = a.courses + a.topics + a.ai_requests;
      const activityB = b.courses + b.topics + b.ai_requests;
      return activityB - activityA;
    });

    // 3. AI usage breakdown
    const { data: aiJobs } = await supabase
      .from('ai_jobs')
      .select('job_type, status, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const aiByType: Record<string, { total: number; success: number; failed: number }> = {};
    aiJobs?.forEach((job) => {
      if (!aiByType[job.job_type]) {
        aiByType[job.job_type] = { total: 0, success: 0, failed: 0 };
      }
      aiByType[job.job_type].total++;
      if (job.status === 'completed') {
        aiByType[job.job_type].success++;
      } else if (job.status === 'failed') {
        aiByType[job.job_type].failed++;
      }
    });

    const aiUsage = Object.entries(aiByType).map(([type, stats]) => ({
      type,
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    }));

    // 4. Weekly comparison
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [thisWeekUsers, lastWeekUsers, thisWeekJobs, lastWeekJobs] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('ai_jobs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('ai_jobs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString()),
    ]);

    const weeklyComparison = {
      users: {
        thisWeek: thisWeekUsers.count || 0,
        lastWeek: lastWeekUsers.count || 0,
        change: lastWeekUsers.count 
          ? Math.round(((thisWeekUsers.count || 0) - (lastWeekUsers.count || 0)) / lastWeekUsers.count * 100) 
          : 0,
      },
      aiJobs: {
        thisWeek: thisWeekJobs.count || 0,
        lastWeek: lastWeekJobs.count || 0,
        change: lastWeekJobs.count 
          ? Math.round(((thisWeekJobs.count || 0) - (lastWeekJobs.count || 0)) / lastWeekJobs.count * 100) 
          : 0,
      },
    };

    return new Response(
      JSON.stringify({
        totals,
        dailySignups,
        topUsers: userStats.slice(0, 20),
        aiUsage,
        weeklyComparison,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin stats error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
