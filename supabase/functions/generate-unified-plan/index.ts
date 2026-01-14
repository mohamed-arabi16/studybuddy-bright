import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { calculateUrgencyScore } from "../_shared/urgency-constants.ts";

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
  is_review?: boolean;
}

// ========================
// TIMEZONE-STABLE DATE UTILITIES
// ========================

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getUTCDay()];
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

// ========================
// ENHANCED COURSE PRIORITY CALCULATION
// Uses exponential urgency decay and weighted workload assessment
// ========================

interface CoursePriorityContext {
  daysUntilExam: number;
  remainingTopics: number;
  totalHours: number;
  avgDifficulty: number;
  avgImportance: number;
}

function calculateCoursePriority(course: Course, today: Date): number {
  if (!course.exam_date) return 0;
  
  const examDate = new Date(course.exam_date);
  const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExam <= 0) return 0;
  
  const pendingTopics = course.topics.filter(t => t.status !== 'done');
  const remainingTopics = pendingTopics.length;
  
  if (remainingTopics === 0) return 0;
  
  const totalHours = pendingTopics.reduce((sum, t) => sum + (t.estimated_hours || 1), 0);
  const avgDifficulty = pendingTopics.reduce((sum, t) => sum + (t.difficulty_weight || 3), 0) / remainingTopics;
  const avgImportance = pendingTopics.reduce((sum, t) => sum + (t.exam_importance || 3), 0) / remainingTopics;
  
  // Calculate priority using enhanced algorithm
  return calculateEnhancedPriority({
    daysUntilExam,
    remainingTopics,
    totalHours,
    avgDifficulty,
    avgImportance,
  });
}

function calculateEnhancedPriority(ctx: CoursePriorityContext): number {
  const { daysUntilExam, remainingTopics, totalHours, avgDifficulty, avgImportance } = ctx;
  
  // 1. Exponential Urgency Score using shared calculation function
  // Sharp increase as deadline approaches (sigmoid-like curve)
  // Critical zone: < 7 days (very high urgency)
  // Warning zone: 7-14 days (high urgency)
  // Comfortable zone: > 14 days (moderate urgency)
  const urgencyFactor = calculateUrgencyScore(daysUntilExam);
  
  // 2. Workload Density Score
  // How much work per available day
  const hoursPerDay = totalHours / Math.max(1, daysUntilExam);
  const workloadDensity = Math.min(1, hoursPerDay / 3); // Normalize to max 3 hours/day being "full"
  
  // 3. Topic Importance Score
  // Higher importance courses get priority
  const importanceScore = (avgImportance - 1) / 4; // Normalize 1-5 to 0-1
  
  // 4. Difficulty Adjustment
  // Harder courses need to start earlier (more time for understanding)
  const difficultyBonus = (avgDifficulty - 3) * 0.1; // +/- 0.2 for extreme difficulties
  
  // 5. Volume Factor
  // More topics means more scheduling priority
  const volumeFactor = Math.min(1, remainingTopics / 15); // Normalize to 15 topics being "full course"
  
  // Combined weighted priority score
  const priority = 
    (urgencyFactor * 40) +           // Urgency dominates (0-40)
    (workloadDensity * 25) +         // Workload density (0-25)
    (importanceScore * 20) +         // Importance (0-20)
    (difficultyBonus * 10) +         // Difficulty adjustment (-2 to +2)
    (volumeFactor * 15);             // Volume (0-15)
  
  return Math.max(0, priority);
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

    // ============= P0-2: RATE LIMITING =============
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'generate-unified-plan');
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      return createRateLimitResponse(rateLimitResult);
    }

    console.log(`Generating unified plan for user ${user.id}, mode: ${mode}`);

    // Fetch user preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_study_hours, study_days_per_week, days_off")
      .eq("user_id", user.id)
      .single();

    const dailyStudyHours = profile?.daily_study_hours || 3;
    const studyDaysPerWeek = profile?.study_days_per_week || 7;
    
    // Derive days off from study_days_per_week if not explicitly set
    let daysOff: string[] = profile?.days_off || [];
    if (daysOff.length === 0 && studyDaysPerWeek < 7) {
      const defaultOff = ['saturday', 'sunday'];
      daysOff = defaultOff.slice(0, 7 - studyDaysPerWeek);
    }

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
        success: false,
        error: "No active courses found",
        error_code: "NO_ACTIVE_COURSES",
        suggestion: "Add a course with topics and an exam date to generate a study plan",
        plan_days: 0,
        plan_items: 0 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIXED: Use timezone-stable date handling
    const today = getTodayUTC();
    const todayStr = getDateStr(today);

    // Process courses and filter topics (initial pass without hour compression)
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
          // Store original estimated hours (will be compressed if needed)
          estimated_hours: t.estimated_hours || 1.5,
          order_index: t.order_index || 0,
        })),
    })).filter(c => c.topics.length > 0);

    if (processedCourses.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: "All topics are completed!",
        message_code: "ALL_COMPLETED",
        plan_days: 0,
        plan_items: 0,
        suggestions: ["celebrate_achievement", "add_new_topics_for_review"]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any courses have exam dates set - warn if none do
    const coursesWithExamDates = processedCourses.filter(c => c.exam_date !== null);
    const coursesWithoutExamDates = processedCourses.filter(c => c.exam_date === null);
    
    if (coursesWithExamDates.length === 0) {
      console.log("Warning: No courses have exam dates set - using default 30-day horizon");
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

    // FIXED: Calculate plan duration based on LATEST exam (not earliest), capped at 90 days
    let maxExamDays = 30; // Default if no exam dates
    for (const course of sortedCourses) {
      if (course.exam_date) {
        const examDate = new Date(course.exam_date);
        const daysUntil = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil > 0 && daysUntil > maxExamDays) {
          maxExamDays = daysUntil;
        }
      }
    }
    const planDays = Math.min(maxExamDays, 90);

    console.log(`Planning horizon: ${planDays} days (max exam in ${maxExamDays} days)`);

    // ========================
    // FEASIBILITY CHECK & TIME COMPRESSION
    // Calculate available vs required hours and compress topic hours if needed
    // ========================
    
    // Count available study days (excluding days off and days past exam dates)
    let availableStudyDays = 0;
    let tempDate = new Date(today);
    for (let i = 0; i < planDays; i++) {
      const dayOfWeek = getDayOfWeek(tempDate);
      if (!daysOff.includes(dayOfWeek)) {
        availableStudyDays++;
      }
      tempDate = addDays(tempDate, 1);
    }
    
    // Calculate total hours needed and available
    const totalRequiredHours = sortedCourses.reduce((sum, c) => 
      sum + c.topics.reduce((s, t) => s + t.estimated_hours, 0), 0);
    const totalAvailableHours = availableStudyDays * dailyStudyHours;
    const minHoursPerTopic = 0.25;
    const totalTopicsCount = sortedCourses.reduce((s, c) => s + c.topics.length, 0);
    const minRequiredHours = totalTopicsCount * minHoursPerTopic;
    
    // Calculate coverage ratio - how much of the required time we can cover
    const coverageRatio = totalRequiredHours > 0 
      ? Math.min(1, totalAvailableHours / totalRequiredHours)
      : 1;
    
    const isPriorityMode = coverageRatio < 1;
    
    console.log(`Feasibility: ${totalRequiredHours.toFixed(1)}h required, ${totalAvailableHours.toFixed(1)}h available, coverage: ${(coverageRatio * 100).toFixed(0)}%, priority mode: ${isPriorityMode}`);

    // Track scheduling state
    const scheduledTopicIds = new Set<string>(); // All topics scheduled so far
    const topicRemainingHours = new Map<string, number>(); // Track split topics
    const coursePointers = new Map<string, number>();
    sortedCourses.forEach(c => {
      coursePointers.set(c.id, 0);
      // Apply time compression when time is insufficient (coverageRatio < 1)
      // This ensures topics get scheduled even when time is limited
      c.topics.forEach(t => {
        const compressedHours = isPriorityMode 
          ? Math.max(minHoursPerTopic, t.estimated_hours * coverageRatio)
          : t.estimated_hours;
        topicRemainingHours.set(t.id, compressedHours);
      });
    });

    const schedule: ScheduledItem[] = [];
    const dailySchedule = new Map<string, { hours: number; items: ScheduledItem[] }>();
    
    let currentDate = new Date(today);
    let studyDaysCreated = 0;
    const totalTopics = sortedCourses.reduce((s, c) => s + c.topics.length, 0);

    for (let dayIndex = 0; dayIndex < planDays && scheduledTopicIds.size < totalTopics; dayIndex++) {
      // FIXED: Use timezone-stable date handling
      const dateStr = getDateStr(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      const isDayOff = daysOff.includes(dayOfWeek);

      if (!isDayOff) {
        let remainingHours = dailyStudyHours;
        const dayItems: ScheduledItem[] = [];
        let noProgressIterations = 0;
        // Increase max iterations to allow more attempts when topics complete and unlock others
        const maxNoProgressIterations = (sortedCourses.length + 1) * 2;
        
        // Track topics scheduled THIS DAY for same-day prerequisite checking
        const topicsScheduledToday = new Set<string>();

        while (remainingHours > 0.25 && noProgressIterations < maxNoProgressIterations) {
          let madeProgress = false;
          
          // Get courses with remaining topics, filtering by exam date
          const coursesWithTopics = sortedCourses.filter(c => {
            const pointer = coursePointers.get(c.id) || 0;
            if (pointer >= c.topics.length) return false;
            
            // FIXED: Don't schedule topics on or after exam date
            if (c.exam_date && dateStr >= c.exam_date) return false;
            
            return true;
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
            
            // Check prerequisites - includes topics scheduled earlier today for same-day dependency resolution
            const prereqs = topic.prerequisite_ids || [];
            const allPrereqsMet = prereqs.every(prereqId => 
              scheduledTopicIds.has(prereqId) || 
              topicsScheduledToday.has(prereqId) ||
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
              is_review: false,
            });

            remainingHours -= hoursToSchedule;
            const newRemaining = topicRemaining - hoursToSchedule;
            topicRemainingHours.set(topic.id, newRemaining);

            // Only advance pointer and mark as scheduled when topic is fully scheduled
            if (newRemaining <= 0.1) {
              scheduledTopicIds.add(topic.id);
              topicsScheduledToday.add(topic.id);
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

      currentDate = addDays(currentDate, 1);
    }

    console.log(`Generated ${schedule.length} items across ${studyDaysCreated} study days`);

    // Get current max plan version
    const { data: maxVersionData } = await supabase
      .from('study_plan_days')
      .select('plan_version')
      .eq('user_id', user.id)
      .order('plan_version', { ascending: false })
      .limit(1);
    
    const newPlanVersion = (maxVersionData?.[0]?.plan_version || 0) + 1;

    // Delete existing plan data
    if (mode === "recreate") {
      // Get future day IDs to delete their items
      const { data: futureDays } = await supabase
        .from("study_plan_days")
        .select("id")
        .eq("user_id", user.id)
        .gte("date", todayStr);

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
      plan_version: number;
    }> = [];

    currentDate = new Date(today);
    for (let i = 0; i < planDays; i++) {
      const dateStr = getDateStr(currentDate);
      const dayOfWeek = getDayOfWeek(currentDate);
      const isDayOff = daysOff.includes(dayOfWeek);
      const dayData = dailySchedule.get(dateStr);

      daysToInsert.push({
        user_id: user.id,
        date: dateStr,
        total_hours: dayData?.hours || 0,
        is_day_off: isDayOff,
        plan_version: newPlanVersion,
      });

      currentDate = addDays(currentDate, 1);
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
      is_review: boolean;
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
        is_review: item.is_review || false,
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
        plan_version: newPlanVersion,
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
        has_exam_date: !!c.exam_date,
      };
    });

    const warnings: string[] = [];
    if (hasAnyCycles) warnings.push("circular_dependencies_detected");
    if (isPriorityMode) {
      warnings.push(`time_compressed: ${(coverageRatio * 100).toFixed(0)}% coverage ratio applied`);
    }
    if (coursesWithoutExamDates.length > 0) {
      warnings.push(`${coursesWithoutExamDates.length} course(s) without exam dates - using default schedule`);
    }

    // Calculate study recommendations based on workload analysis
    const avgHoursPerStudyDay = studyDaysCreated > 0 
      ? Array.from(dailySchedule.values()).reduce((s, d) => s + d.hours, 0) / studyDaysCreated 
      : 0;
    
    // Determine workload intensity for UI feedback
    type WorkloadIntensity = 'light' | 'moderate' | 'heavy' | 'overloaded';
    let workloadIntensity: WorkloadIntensity = 'moderate';
    if (avgHoursPerStudyDay < dailyStudyHours * 0.5) {
      workloadIntensity = 'light';
    } else if (avgHoursPerStudyDay > dailyStudyHours * 0.9) {
      workloadIntensity = isPriorityMode ? 'overloaded' : 'heavy';
    }

    // Calculate estimated completion date
    let estimatedCompletionDate: string | null = null;
    if (studyDaysCreated > 0 && scheduledTopicIds.size === totalTopicsCount) {
      // All topics scheduled - find the last study day using proper date comparison
      const scheduleDates = Array.from(dailySchedule.keys());
      const lastStudyDate = scheduleDates.sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
      ).pop();
      if (lastStudyDate) {
        estimatedCompletionDate = lastStudyDate;
      }
    }

    // Generate actionable suggestions based on plan analysis
    const suggestions: string[] = [];
    if (isPriorityMode && coverageRatio < 0.7) {
      suggestions.push("consider_extending_daily_hours");
      suggestions.push("consider_adding_study_days");
    }
    if (hasAnyCycles) {
      suggestions.push("review_topic_prerequisites");
    }
    if (avgHoursPerStudyDay > dailyStudyHours * 0.95) {
      suggestions.push("consider_topic_splitting");
    }
    // Add suggestion if some courses have topics very close to exam
    const urgentCourses = coursesIncluded.filter(c => c.urgency === 'high');
    if (urgentCourses.length > 0) {
      suggestions.push("focus_on_urgent_courses");
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        plan_days: insertedDays?.length || 0,
        plan_items: planItemsCreatedCount,
        plan_version: newPlanVersion,
        total_hours: Array.from(dailySchedule.values()).reduce((s, d) => s + d.hours, 0),
        courses_included: coursesIncluded,
        warnings,
        // Feasibility metrics returned to client for UI display and monitoring
        is_priority_mode: isPriorityMode,
        coverage_ratio: coverageRatio,
        total_required_hours: totalRequiredHours,
        total_available_hours: totalAvailableHours,
        topics_scheduled: scheduledTopicIds.size,
        topics_total: totalTopicsCount,
        // New enhanced feedback for better UX
        workload_intensity: workloadIntensity,
        avg_hours_per_study_day: Math.round(avgHoursPerStudyDay * 10) / 10,
        study_days_created: studyDaysCreated,
        estimated_completion_date: estimatedCompletionDate,
        suggestions,
        urgent_courses_count: urgentCourses.length,
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
