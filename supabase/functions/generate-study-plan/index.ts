import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateUrgencyScore } from "../_shared/urgency-constants.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Course {
  id: string;
  title: string;
  exam_date: string;
  topics: Topic[];
}

interface Topic {
  id: string;
  title: string;
  difficulty_weight: number;
  exam_importance: number;
  estimated_hours: number;
  status: string;
}

interface CourseAllocation {
  course: Course;
  days_left: number;
  workload: number;
  urgency: number;
  daily_hours: number;
  remaining_topics: Topic[];
}

// Detailed error codes for better client-side handling
const ErrorCode = {
  NO_COURSES: 'NO_COURSES',
  NO_EXAM_DATES: 'NO_EXAM_DATES',
  NO_TOPICS: 'NO_TOPICS',
  ALL_TOPICS_DONE: 'ALL_TOPICS_DONE',
  EXAM_PASSED: 'EXAM_PASSED',
  INSUFFICIENT_TIME: 'INSUFFICIENT_TIME',
} as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body for reschedule mode
    let rescheduleMode = false;
    let includeMissedItems = true;
    try {
      const body = await req.json();
      rescheduleMode = body.reschedule === true;
      includeMissedItems = body.includeMissedItems !== false;
    } catch {
      // No body, use defaults
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('daily_study_hours, study_days_per_week, days_off')
      .eq('user_id', user.id)
      .single();

    const dailyStudyHours = profile?.daily_study_hours || 3;
    const studyDaysPerWeek = profile?.study_days_per_week || 6;
    const daysOff: string[] = profile?.days_off || [];

    // If reschedule mode, analyze missed items first
    const missedItemsData: any[] = [];
    let missedDaysCount = 0;
    
    if (rescheduleMode && includeMissedItems) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);

      // Find incomplete items from past days
      const { data: pastDays } = await supabase
        .from('study_plan_days')
        .select(`
          id,
          date,
          study_plan_items (
            id,
            is_completed,
            topic_id,
            course_id,
            hours
          )
        `)
        .eq('user_id', user.id)
        .gte('date', weekAgo.toISOString().split('T')[0])
        .lt('date', today.toISOString().split('T')[0])
        .eq('is_day_off', false);

      if (pastDays) {
        for (const day of pastDays) {
          const items = (day as any).study_plan_items || [];
          const incompleteItems = items.filter((i: any) => !i.is_completed);
          if (incompleteItems.length > 0) {
            missedDaysCount++;
            missedItemsData.push(...incompleteItems);
          }
        }
      }
      
      console.log(`Reschedule mode: Found ${missedItemsData.length} missed items from ${missedDaysCount} days`);
    }

    // Get all active courses with topics
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        exam_date,
        topics (
          id,
          title,
          difficulty_weight,
          exam_importance,
          status
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('exam_date', 'is', null)
      .order('exam_date', { ascending: true });

    if (coursesError) {
      console.error('Failed to fetch courses:', coursesError);
      throw new Error('Failed to fetch courses');
    }

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active courses with exam dates found',
          code: ErrorCode.NO_EXAM_DATES,
          hint: 'Add courses with exam dates to generate a study plan. Go to Courses > Add Course and set an exam date.',
          action: 'add_course',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating plan for ${courses.length} courses (reschedule: ${rescheduleMode})`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Track courses with past exam dates for warning
    const coursesWithPastExams: string[] = [];
    const coursesWithNoTopics: string[] = [];

    // Calculate course allocations using enhanced priority scoring
    const courseAllocations: CourseAllocation[] = courses.map((course: Course) => {
      const examDate = new Date(course.exam_date);
      examDate.setHours(0, 0, 0, 0);
      
      // Check if exam date has passed
      const rawDaysLeft = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (rawDaysLeft < 0) {
        coursesWithPastExams.push(course.title);
        console.log(`Skipping course "${course.title}" - exam date has passed (${rawDaysLeft} days ago)`);
        return null;
      }
      
      const daysLeft = Math.max(1, rawDaysLeft);
      
      const remainingTopics = (course.topics || []).filter((t: Topic) => t.status !== 'done');
      
      if (remainingTopics.length === 0) {
        coursesWithNoTopics.push(course.title);
        console.log(`Skipping course "${course.title}" - no remaining topics`);
        return null;
      }
      
      // Calculate average difficulty and importance for smarter allocation
      const avgDifficulty = remainingTopics.reduce((sum: number, t: Topic) => 
        sum + (t.difficulty_weight || 3), 0) / remainingTopics.length;
      const avgImportance = remainingTopics.reduce((sum: number, t: Topic) => 
        sum + (t.exam_importance || 3), 0) / remainingTopics.length;
      const totalHours = remainingTopics.reduce((sum: number, t: Topic) => 
        sum + (t.estimated_hours || 1), 0);
      
      // Enhanced urgency calculation using shared function
      // Critical zone: < 7 days (urgency 0.7-1.0)
      // Warning zone: 7-14 days (urgency 0.4-0.7)
      // Comfortable zone: > 14 days (urgency 0.1-0.4)
      const urgencyBase = calculateUrgencyScore(daysLeft);
      
      // Workload density: hours needed per day
      const workloadDensity = totalHours / Math.max(1, daysLeft);
      
      // Calculate workload: weighted combination of factors
      const workload = 
        (urgencyBase * 40) +                                    // Urgency (0-40)
        (workloadDensity * 25) +                                // Density (0-25)
        ((avgImportance - 1) / 4 * 20) +                       // Importance (0-20)
        ((avgDifficulty - 3) * 3) +                            // Difficulty adjustment (-6 to +6)
        (Math.min(remainingTopics.length / 15, 1) * 15);       // Volume (0-15)
      
      // In reschedule mode, add extra weight for missed items from this course
      let adjustedWorkload = workload;
      if (rescheduleMode && includeMissedItems) {
        const missedForCourse = missedItemsData.filter((i: any) => i.course_id === course.id);
        adjustedWorkload += missedForCourse.length * 8; // Boost urgency for missed items
      }
      
      // Urgency is now the combined score
      const urgency = Math.max(0, adjustedWorkload);

      return {
        course,
        days_left: daysLeft,
        workload: adjustedWorkload,
        urgency,
        daily_hours: 0,
        remaining_topics: remainingTopics.sort((a: Topic, b: Topic) => {
          // Enhanced sorting: prioritize by combined score
          const scoreA = ((a.exam_importance || 3) * 2) + (a.difficulty_weight || 3);
          const scoreB = ((b.exam_importance || 3) * 2) + (b.difficulty_weight || 3);
          return scoreB - scoreA; // Highest score first
        }),
      };
    }).filter((ca): ca is CourseAllocation => ca !== null && ca.remaining_topics.length > 0);

    if (courseAllocations.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'All topics are completed!', 
          code: ErrorCode.ALL_TOPICS_DONE,
          hint: 'Great job! All your topics are complete. Add new topics or courses to create a new study plan.',
          plan_days: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate daily hours per course (proportional to urgency with better balancing)
    const totalUrgency = courseAllocations.reduce((sum, ca) => sum + ca.urgency, 0);
    
    // In reschedule mode, allow slightly more hours per day to catch up
    const effectiveDailyHours = rescheduleMode 
      ? Math.min(dailyStudyHours * 1.2, dailyStudyHours + 1) 
      : dailyStudyHours;
    
    courseAllocations.forEach(ca => {
      ca.daily_hours = totalUrgency > 0 
        ? (ca.urgency / totalUrgency) * effectiveDailyHours 
        : effectiveDailyHours / courseAllocations.length;
      
      // Dynamic cap based on urgency - very urgent courses can take more time
      const urgencyRatio = ca.urgency / totalUrgency;
      const maxRatio = urgencyRatio > 0.5 ? 0.8 : 0.7; // Higher cap for dominant urgent course
      ca.daily_hours = Math.min(ca.daily_hours, effectiveDailyHours * maxRatio);
      
      // Minimum 0.5 hours per course
      ca.daily_hours = Math.max(ca.daily_hours, 0.5);
    });

    // Find the latest exam date to determine plan length
    const latestExam = Math.max(...courseAllocations.map(ca => ca.days_left));
    const planDays = Math.min(latestExam, 30); // Cap at 30 days

    // Delete existing plan for this user (future days only in reschedule mode)
    if (rescheduleMode) {
      // Only delete future days, keep past days for history
      await supabase
        .from('study_plan_days')
        .delete()
        .eq('user_id', user.id)
        .gte('date', today.toISOString().split('T')[0]);
    } else {
      // Full regeneration - delete all
      const { data: existingDays } = await supabase
        .from('study_plan_days')
        .select('id')
        .eq('user_id', user.id);

      if (existingDays && existingDays.length > 0) {
        await supabase
          .from('study_plan_days')
          .delete()
          .eq('user_id', user.id);
      }
    }

    // Get next plan version
    const planVersion = rescheduleMode ? 2 : 1;

    // Track topic assignment across days
    const topicAssignments: Map<string, number> = new Map(); // topic_id -> times assigned

    const createdDays: any[] = [];
    const createdItems: any[] = [];

    // Generate plan for each day
    for (let dayOffset = 0; dayOffset < planDays; dayOffset++) {
      const planDate = new Date(today);
      planDate.setDate(today.getDate() + dayOffset);
      
      const dateStr = planDate.toISOString().split('T')[0];
      const dayOfWeek = planDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Check if it's a day off
      const isDayOff = daysOff.includes(dayOfWeek) || daysOff.includes(dateStr);
      
      // Create plan day with potentially higher hours in reschedule mode for first week
      const dayHours = isDayOff ? 0 : (rescheduleMode && dayOffset < 7 ? effectiveDailyHours : dailyStudyHours);
      
      const { data: planDay, error: dayError } = await supabase
        .from('study_plan_days')
        .insert({
          user_id: user.id,
          plan_version: planVersion,
          date: dateStr,
          total_hours: dayHours,
          is_day_off: isDayOff,
        })
        .select()
        .single();

      if (dayError) {
        console.error('Failed to create plan day:', dayError);
        continue;
      }

      createdDays.push(planDay);

      if (isDayOff) continue;

      // Allocate topics for each course
      let orderIndex = 0;
      
      for (const ca of courseAllocations) {
        // Skip if exam has passed
        if (ca.days_left <= dayOffset) continue;
        
        // Calculate how many topics to assign today
        const hoursForCourse = ca.daily_hours;
        const avgHoursPerTopic = 0.5; // Assume 30 mins per topic
        const topicsToday = Math.ceil(hoursForCourse / avgHoursPerTopic);
        
        // Get unassigned or least-assigned topics
        const availableTopics = ca.remaining_topics
          .filter(t => (topicAssignments.get(t.id) || 0) < 2) // Max 2 times per topic
          .slice(0, topicsToday);

        for (const topic of availableTopics) {
          const { data: item, error: itemError } = await supabase
            .from('study_plan_items')
            .insert({
              user_id: user.id,
              plan_day_id: planDay.id,
              course_id: ca.course.id,
              topic_id: topic.id,
              hours: hoursForCourse / Math.max(availableTopics.length, 1),
              order_index: orderIndex++,
              is_completed: false,
            })
            .select()
            .single();

          if (!itemError && item) {
            createdItems.push(item);
            topicAssignments.set(topic.id, (topicAssignments.get(topic.id) || 0) + 1);
          }
        }
      }
    }

    console.log(`Created ${createdDays.length} plan days with ${createdItems.length} items`);

    // Create AI job record for tracking
    await supabase.from('ai_jobs').insert({
      user_id: user.id,
      job_type: rescheduleMode ? 'reschedule_plan' : 'generate_plan',
      status: 'completed',
      result_json: {
        days_created: createdDays.length,
        items_created: createdItems.length,
        courses_included: courseAllocations.length,
        missed_items_redistributed: missedItemsData.length,
        reschedule_mode: rescheduleMode,
        courses_skipped_past_exam: coursesWithPastExams.length,
        courses_skipped_no_topics: coursesWithNoTopics.length,
      },
    });

    // Build warnings array for client feedback
    const warnings: string[] = [];
    if (coursesWithPastExams.length > 0) {
      warnings.push(`Skipped ${coursesWithPastExams.length} course(s) with past exam dates: ${coursesWithPastExams.join(', ')}`);
    }
    if (coursesWithNoTopics.length > 0) {
      warnings.push(`Skipped ${coursesWithNoTopics.length} course(s) with no remaining topics`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_days: createdDays.length,
        plan_items: createdItems.length,
        reschedule_mode: rescheduleMode,
        missed_items_count: missedItemsData.length,
        missed_days_count: missedDaysCount,
        warnings: warnings.length > 0 ? warnings : undefined,
        courses_included: courseAllocations.map(ca => ({
          id: ca.course.id,
          title: ca.course.title,
          days_left: ca.days_left,
          urgency: ca.urgency.toFixed(2),
          daily_hours: ca.daily_hours.toFixed(1),
          remaining_topics: ca.remaining_topics.length,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-study-plan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
