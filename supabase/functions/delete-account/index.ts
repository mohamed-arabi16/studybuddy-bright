import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key for admin operations
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
    logStep("User authenticated", { userId });

    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete study plan items first (references study_plan_days, topics, courses)
    const { error: itemsError } = await supabaseAdmin
      .from('study_plan_items')
      .delete()
      .eq('user_id', userId);
    if (itemsError) logStep("Error deleting study_plan_items", { error: itemsError });

    // 2. Delete study plan days
    const { error: daysError } = await supabaseAdmin
      .from('study_plan_days')
      .delete()
      .eq('user_id', userId);
    if (daysError) logStep("Error deleting study_plan_days", { error: daysError });

    // 3. Delete pomodoro sessions (references topics)
    const { error: pomodoroError } = await supabaseAdmin
      .from('pomodoro_sessions')
      .delete()
      .eq('user_id', userId);
    if (pomodoroError) logStep("Error deleting pomodoro_sessions", { error: pomodoroError });

    // 4. Delete allocations (references courses)
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('user_id', userId);
    
    if (courses && courses.length > 0) {
      const courseIds = courses.map(c => c.id);
      
      const { error: allocationsError } = await supabaseAdmin
        .from('allocations')
        .delete()
        .in('course_id', courseIds);
      if (allocationsError) logStep("Error deleting allocations", { error: allocationsError });
    }

    // 5. Delete topics (references courses)
    const { error: topicsError } = await supabaseAdmin
      .from('topics')
      .delete()
      .eq('user_id', userId);
    if (topicsError) logStep("Error deleting topics", { error: topicsError });

    // 6. Delete course files
    const { error: filesError } = await supabaseAdmin
      .from('course_files')
      .delete()
      .eq('user_id', userId);
    if (filesError) logStep("Error deleting course_files", { error: filesError });

    // 7. Delete AI jobs
    const { error: aiJobsError } = await supabaseAdmin
      .from('ai_jobs')
      .delete()
      .eq('user_id', userId);
    if (aiJobsError) logStep("Error deleting ai_jobs", { error: aiJobsError });

    // 8. Delete courses
    const { error: coursesError } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('user_id', userId);
    if (coursesError) logStep("Error deleting courses", { error: coursesError });

    // 9. Delete study sessions
    const { error: sessionsError } = await supabaseAdmin
      .from('study_sessions')
      .delete()
      .eq('user_id', userId);
    if (sessionsError) logStep("Error deleting study_sessions", { error: sessionsError });

    // 10. Delete feedback
    const { error: feedbackError } = await supabaseAdmin
      .from('feedback')
      .delete()
      .eq('user_id', userId);
    if (feedbackError) logStep("Error deleting feedback", { error: feedbackError });

    // 11. Delete Google Calendar connections
    const { error: calendarError } = await supabaseAdmin
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', userId);
    if (calendarError) logStep("Error deleting google_calendar_connections", { error: calendarError });

    // 12. Delete subscriptions
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    if (subscriptionsError) logStep("Error deleting subscriptions", { error: subscriptionsError });

    // 13. Delete admin overrides (if any)
    const { error: overridesError } = await supabaseAdmin
      .from('admin_overrides')
      .delete()
      .eq('user_id', userId);
    if (overridesError) logStep("Error deleting admin_overrides", { error: overridesError });

    // 14. Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (rolesError) logStep("Error deleting user_roles", { error: rolesError });

    // 15. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    if (profileError) logStep("Error deleting profile", { error: profileError });

    // 16. Delete storage files
    try {
      const { data: files } = await supabaseAdmin.storage
        .from('course-files')
        .list(userId);
      
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${userId}/${f.name}`);
        await supabaseAdmin.storage
          .from('course-files')
          .remove(filePaths);
        logStep("Storage files deleted", { count: files.length });
      }
    } catch (storageError) {
      logStep("Error deleting storage files (non-fatal)", { error: storageError });
    }

    // 17. Finally, delete the auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      logStep("Error deleting auth user", { error: authDeleteError });
      throw new Error("Failed to delete user account");
    }

    logStep("Account deleted successfully", { userId });

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
