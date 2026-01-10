import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Topic {
  id: string;
  title: string;
  course_id: string;
  difficulty_weight: number;
  exam_importance: number;
  estimated_hours: number;
  prerequisite_ids: string[] | null;
  status: string;
  order_index: number;
}

interface Course {
  id: string;
  title: string;
  color: string;
  exam_date: string | null;
  topics: Topic[];
}

interface ScheduledItem {
  date: string;
  topic_id: string;
  course_id: string;
  hours: number;
  order_index: number;
}

// Topological sort using Kahn's algorithm with cycle detection
function topologicalSort(topics: Topic[]): { sorted: Topic[]; hasCycles: boolean } {
  const topicMap = new Map<string, Topic>();
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  // Initialize
  topics.forEach(t => {
    topicMap.set(t.id, t);
    inDegree.set(t.id, 0);
    graph.set(t.id, []);
  });

  // Build dependency graph
  topics.forEach(t => {
    const prereqs = t.prerequisite_ids || [];
    prereqs.forEach(prereqId => {
      if (topicMap.has(prereqId)) {
        const currentDegree = inDegree.get(t.id) || 0;
        inDegree.set(t.id, currentDegree + 1);
        
        const dependents = graph.get(prereqId) || [];
        dependents.push(t.id);
        graph.set(prereqId, dependents);
      }
    });
  });

  // Find all topics with no prerequisites
  const queue: Topic[] = [];
  topics.forEach(t => {
    if ((inDegree.get(t.id) || 0) === 0) {
      queue.push(t);
    }
  });

  // Sort queue by order_index for deterministic results
  queue.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const sorted: Topic[] = [];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const dependents = graph.get(current.id) || [];
    for (const depId of dependents) {
      const newDegree = (inDegree.get(depId) || 1) - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) {
        const depTopic = topicMap.get(depId);
        if (depTopic) {
          let inserted = false;
          for (let i = 0; i < queue.length; i++) {
            if ((queue[i].order_index || 0) > (depTopic.order_index || 0)) {
              queue.splice(i, 0, depTopic);
              inserted = true;
              break;
            }
          }
          if (!inserted) queue.push(depTopic);
        }
      }
    }
  }

  // Detect cycles - if we couldn't sort all topics
  const hasCycles = sorted.length < topics.length;
  
  // Append remaining topics (those with unmet dependencies / cycles)
  if (hasCycles) {
    const remaining = topics
      .filter(t => !sorted.find(s => s.id === t.id))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    sorted.push(...remaining);
  }

  return { sorted, hasCycles };
}

// Calculate priority score for a course based on exam proximity and workload
function calculateCoursePriority(course: Course, today: Date): number {
  if (!course.exam_date) return 0;
  
  const examDate = new Date(course.exam_date);
  const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExam <= 0) return 0;
  
  const remainingTopics = course.topics.filter(t => t.status !== 'done').length;
  const totalHours = course.topics
    .filter(t => t.status !== 'done')
    .reduce((sum, t) => sum + (t.estimated_hours || 1), 0);
  
  return (1 / daysUntilExam) * (totalHours + remainingTopics);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "full";
    const excludeCompleted = body.excludeCompleted !== false;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating unified plan for user ${user.id}, mode: ${mode}`);

    // Fetch user preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_study_hours, study_days_per_week, days_off")
      .eq("user_id", user.id)
      .single();

    const dailyStudyHours = profile?.daily_study_hours || 3;
    const daysOff = profile?.days_off || [];

    // Fetch all active courses with topics
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select(`
        id,
        title,
        color,
        exam_date,
        topics (
          id,
          title,
          course_id,
          difficulty_weight,
          exam_importance,
          estimated_hours,
          prerequisite_ids,
          status,
          order_index
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (coursesError) throw coursesError;

    if (!courses || courses.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No active courses found",
        plan_days: 0,
        plan_items: 0 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process courses and filter topics
    const processedCourses: Course[] = courses.map(c => ({
      id: c.id,
      title: c.title,
      color: c.color || "#6366f1",
      exam_date: c.exam_date,
      topics: (c.topics || [])
        .filter(t => !excludeCompleted || t.status !== 'done')
        .map(t => ({
          ...t,
          difficulty_weight: t.difficulty_weight || 3,
          exam_importance: t.exam_importance || 3,
          // Apply minimum hours based on difficulty
          estimated_hours: Math.max(t.estimated_hours || 1.5, (t.difficulty_weight || 3) * 0.5),
          order_index: t.order_index || 0,
        })),
    })).filter(c => c.topics.length > 0);

    if (processedCourses.length === 0) {
      return new Response(JSON.stringify({ 
        message: "All topics are completed!",
        plan_days: 0,
        plan_items: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply topological sort to each course's topics
    let hasAnyCycles = false;
    const sortedCourses = processedCourses.map(c => {
      const { sorted, hasCycles } = topologicalSort(c.topics);
      if (hasCycles) hasAnyCycles = true;
      return { ...c, topics: sorted };
    });

    // Sort courses by priority
    sortedCourses.sort((a, b) => 
      calculateCoursePriority(b, today) - calculateCoursePriority(a, today)
    );

    // Calculate plan duration based on earliest exam
    let planDays = 30;
    for (const course of sortedCourses) {
      if (course.exam_date) {
        const examDate = new Date(course.exam_date);
        const daysUntil = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil > 0 && daysUntil < planDays) {
          planDays = daysUntil;
        }
      }
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Track scheduling state
    const scheduledTopicIds = new Set<string>(); // All topics scheduled so far
    const topicRemainingHours = new Map<string, number>(); // Track split topics
    const coursePointers = new Map<string, number>();
    sortedCourses.forEach(c => {
      coursePointers.set(c.id, 0);
      c.topics.forEach(t => topicRemainingHours.set(t.id, t.estimated_hours));
    });

    const schedule: ScheduledItem[] = [];
    const dailySchedule = new Map<string, { hours: number; items: ScheduledItem[] }>();
    
    let currentDate = new Date(today);
    let studyDaysCreated = 0;
    const totalTopics = sortedCourses.reduce((s, c) => s + c.topics.length, 0);

    for (let dayIndex = 0; dayIndex < planDays && scheduledTopicIds.size < totalTopics; dayIndex++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = dayNames[currentDate.getDay()];
      const isDayOff = daysOff.includes(dayOfWeek);

      if (!isDayOff) {
        let remainingHours = dailyStudyHours;
        const dayItems: ScheduledItem[] = [];
        let noProgressIterations = 0;
        const maxNoProgressIterations = sortedCourses.length + 1;

        while (remainingHours > 0.25 && noProgressIterations < maxNoProgressIterations) {
          let madeProgress = false;
          
          // Get courses with remaining topics
          const coursesWithTopics = sortedCourses.filter(c => {
            const pointer = coursePointers.get(c.id) || 0;
            return pointer < c.topics.length;
          }).sort((a, b) => {
            if (!a.exam_date && !b.exam_date) return 0;
            if (!a.exam_date) return 1;
            if (!b.exam_date) return -1;
            const aDays = Math.ceil((new Date(a.exam_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            const bDays = Math.ceil((new Date(b.exam_date).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            return aDays - bDays;
          });

          if (coursesWithTopics.length === 0) break;

          for (const course of coursesWithTopics) {
            if (remainingHours <= 0.25) break;

            const pointer = coursePointers.get(course.id) || 0;
            if (pointer >= course.topics.length) continue;

            const topic = course.topics[pointer];
            
            // Check prerequisites - now includes topics scheduled earlier today
            const prereqs = topic.prerequisite_ids || [];
            const allPrereqsMet = prereqs.every(prereqId => 
              scheduledTopicIds.has(prereqId) || 
              !sortedCourses.some(c => c.topics.some(t => t.id === prereqId && t.status !== 'done'))
            );

            if (!allPrereqsMet) continue;

            // Calculate hours to schedule (handle topic splitting)
            const topicRemaining = topicRemainingHours.get(topic.id) || topic.estimated_hours;
            const hoursToSchedule = Math.min(topicRemaining, remainingHours);

            if (hoursToSchedule <= 0) continue;

            dayItems.push({
              date: dateStr,
              topic_id: topic.id,
              course_id: course.id,
              hours: Math.round(hoursToSchedule * 100) / 100,
              order_index: dayItems.length,
            });

            remainingHours -= hoursToSchedule;
            const newRemaining = topicRemaining - hoursToSchedule;
            topicRemainingHours.set(topic.id, newRemaining);

            // Only advance pointer and mark as scheduled when topic is fully scheduled
            if (newRemaining <= 0.1) {
              scheduledTopicIds.add(topic.id);
              coursePointers.set(course.id, pointer + 1);
            }

            madeProgress = true;
          }

          if (!madeProgress) {
            noProgressIterations++;
          } else {
            noProgressIterations = 0;
          }
        }

        if (dayItems.length > 0) {
          dailySchedule.set(dateStr, {
            hours: dailyStudyHours - remainingHours,
            items: dayItems,
          });
          schedule.push(...dayItems);
          studyDaysCreated++;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Generated ${schedule.length} items across ${studyDaysCreated} study days`);

    // Delete existing plan data
    if (mode === "recreate") {
      // Get future day IDs to delete their items
      const { data: futureDays } = await supabase
        .from("study_plan_days")
        .select("id")
        .eq("user_id", user.id)
        .gte("date", today.toISOString().split('T')[0]);

      if (futureDays && futureDays.length > 0) {
        const futureIds = futureDays.map(d => d.id);
        await supabase
          .from("study_plan_items")
          .delete()
          .in("plan_day_id", futureIds);
        
        await supabase
          .from("study_plan_days")
          .delete()
          .in("id", futureIds);
      }
    } else {
      // Full mode: delete all
      await supabase.from("study_plan_items").delete().eq("user_id", user.id);
      await supabase.from("study_plan_days").delete().eq("user_id", user.id);
    }

    // Batch insert plan days
    const daysToInsert: Array<{
      user_id: string;
      date: string;
      total_hours: number;
      is_day_off: boolean;
    }> = [];

    currentDate = new Date(today);
    for (let i = 0; i < planDays; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = dayNames[currentDate.getDay()];
      const isDayOff = daysOff.includes(dayOfWeek);
      const dayData = dailySchedule.get(dateStr);

      daysToInsert.push({
        user_id: user.id,
        date: dateStr,
        total_hours: dayData?.hours || 0,
        is_day_off: isDayOff,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const { data: insertedDays, error: daysInsertError } = await supabase
      .from("study_plan_days")
      .insert(daysToInsert)
      .select("id, date");

    if (daysInsertError) {
      console.error("Batch days insert error:", daysInsertError);
      throw daysInsertError;
    }

    // Build date -> plan_day_id map
    const dateToIdMap = new Map<string, string>();
    (insertedDays || []).forEach(d => dateToIdMap.set(d.date, d.id));

    // Batch insert plan items
    const itemsToInsert: Array<{
      user_id: string;
      plan_day_id: string;
      course_id: string;
      topic_id: string;
      hours: number;
      order_index: number;
      is_completed: boolean;
    }> = [];

    for (const item of schedule) {
      const planDayId = dateToIdMap.get(item.date);
      if (!planDayId) continue;

      itemsToInsert.push({
        user_id: user.id,
        plan_day_id: planDayId,
        course_id: item.course_id,
        topic_id: item.topic_id,
        hours: item.hours,
        order_index: item.order_index,
        is_completed: false,
      });
    }

    // Insert in batches of 200
    const BATCH_SIZE = 200;
    let planItemsCreatedCount = 0;
    for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
      const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
      const { error: itemsError } = await supabase
        .from("study_plan_items")
        .insert(batch);
      
      if (itemsError) {
        console.error(`Batch items insert error (batch ${i / BATCH_SIZE}):`, itemsError);
      } else {
        planItemsCreatedCount += batch.length;
      }
    }

    // Log AI job
    await supabase.from("ai_jobs").insert({
      user_id: user.id,
      job_type: mode === "recreate" ? "plan_regeneration" : "plan_generation",
      status: "completed",
      result_json: {
        plan_days: insertedDays?.length || 0,
        plan_items: planItemsCreatedCount,
        total_hours_scheduled: Array.from(dailySchedule.values()).reduce((s, d) => s + d.hours, 0),
        has_circular_dependencies: hasAnyCycles,
      },
    });

    // Build course info for response
    const coursesIncluded = sortedCourses.map(c => {
      const examDate = c.exam_date ? new Date(c.exam_date) : null;
      const daysLeft = examDate 
        ? Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const topicsScheduled = schedule.filter(s => s.course_id === c.id).length;
      const hoursScheduled = schedule
        .filter(s => s.course_id === c.id)
        .reduce((sum, s) => sum + s.hours, 0);

      return {
        id: c.id,
        title: c.title,
        days_left: daysLeft,
        remaining_topics: c.topics.length,
        topics_scheduled: topicsScheduled,
        daily_hours: daysLeft && daysLeft > 0 
          ? (hoursScheduled / Math.min(daysLeft, studyDaysCreated || 1)).toFixed(1)
          : hoursScheduled.toFixed(1),
        urgency: daysLeft && daysLeft <= 7 ? "high" : daysLeft && daysLeft <= 14 ? "medium" : "low",
      };
    });

    const warnings: string[] = [];
    if (hasAnyCycles) warnings.push("circular_dependencies_detected");

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        plan_days: insertedDays?.length || 0,
        plan_items: planItemsCreatedCount,
        total_hours: Array.from(dailySchedule.values()).reduce((s, d) => s + d.hours, 0),
        courses_included: coursesIncluded,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unified plan generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
