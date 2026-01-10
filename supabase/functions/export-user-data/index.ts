import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPORT-USER-DATA] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key for full read access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logStep("User authenticated", { userId });

    // Fetch all user data
    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userId,
      email: userEmail,
    };

    // Profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    exportData.profile = profile;

    // Courses
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('user_id', userId);
    exportData.courses = courses || [];

    // Topics
    const { data: topics } = await supabaseAdmin
      .from('topics')
      .select('*')
      .eq('user_id', userId);
    exportData.topics = topics || [];

    // Study Plan Days
    const { data: planDays } = await supabaseAdmin
      .from('study_plan_days')
      .select('*')
      .eq('user_id', userId);
    exportData.studyPlanDays = planDays || [];

    // Study Plan Items
    const { data: planItems } = await supabaseAdmin
      .from('study_plan_items')
      .select('*')
      .eq('user_id', userId);
    exportData.studyPlanItems = planItems || [];

    // Pomodoro Sessions
    const { data: pomodoroSessions } = await supabaseAdmin
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId);
    exportData.pomodoroSessions = pomodoroSessions || [];

    // Course Files metadata (not the actual files)
    const { data: courseFiles } = await supabaseAdmin
      .from('course_files')
      .select('id, file_name, file_size, mime_type, extraction_status, created_at')
      .eq('user_id', userId);
    exportData.courseFiles = courseFiles || [];

    // AI Jobs
    const { data: aiJobs } = await supabaseAdmin
      .from('ai_jobs')
      .select('id, job_type, status, created_at, updated_at')
      .eq('user_id', userId);
    exportData.aiJobs = aiJobs || [];

    // Allocations (via courses)
    if (courses && courses.length > 0) {
      const courseIds = courses.map(c => c.id);
      const { data: allocations } = await supabaseAdmin
        .from('allocations')
        .select('*')
        .in('course_id', courseIds);
      exportData.allocations = allocations || [];
    } else {
      exportData.allocations = [];
    }

    // Subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan_id, current_period_start, current_period_end, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    exportData.subscription = subscription;

    // Feedback
    const { data: feedback } = await supabaseAdmin
      .from('feedback')
      .select('feedback_type, message, rating, created_at')
      .eq('user_id', userId);
    exportData.feedback = feedback || [];

    // Study Sessions
    const { data: studySessions } = await supabaseAdmin
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId);
    exportData.studySessions = studySessions || [];

    logStep("Data exported successfully", { 
      coursesCount: (courses || []).length,
      topicsCount: (topics || []).length,
      planDaysCount: (planDays || []).length,
    });

    // Return as JSON download
    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="zen-study-data-${new Date().toISOString().split('T')[0]}.json"`,
        },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
