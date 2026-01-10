import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Topic {
  id: string;
  title: string;
  difficulty_weight: number;
  exam_importance: number;
  status: string;
  prerequisite_ids: string[];
  estimated_hours: number;
  description?: string;
}

interface Course {
  id: string;
  title: string;
  exam_date: string;
  topics: Topic[];
}

interface ScheduledItem {
  date: string;
  topic_id: string;
  course_id: string;
  hours: number;
  is_review: boolean;
  order_index: number;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SMART-PLAN] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    logStep('User authenticated', { userId: user.id });

    // Get user preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('daily_study_hours, study_days_per_week, days_off')
      .eq('user_id', user.id)
      .single();

    const dailyStudyHours = profile?.daily_study_hours || 3;
    const daysOff: string[] = profile?.days_off || [];

    logStep('User preferences', { dailyStudyHours, daysOff });

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
          status,
          prerequisite_ids,
          estimated_hours,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('exam_date', 'is', null)
      .order('exam_date', { ascending: true });

    if (coursesError) {
      logStep('Error fetching courses', { error: coursesError });
      throw new Error('Failed to fetch courses');
    }

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active courses with exam dates found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Courses fetched', { count: courses.length });

    // Prepare course/topic data for AI analysis - INCLUDE ALL TOPICS (not just incomplete ones)
    const courseData = courses.map((course: any) => {
      const allTopics = (course.topics || []).map((t: Topic) => ({
        id: t.id,
        title: t.title,
        difficulty: t.difficulty_weight || 3,
        importance: t.exam_importance || 3,
        estimated_hours: t.estimated_hours || 1,
        prerequisites: t.prerequisite_ids || [],
        description: t.description || '',
        status: t.status,
      }));

      // Filter to pending topics only for scheduling
      const pendingTopics = allTopics.filter((t: any) => t.status !== 'done');

      return {
        id: course.id,
        title: course.title,
        exam_date: course.exam_date,
        days_until_exam: Math.ceil((new Date(course.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        topics: pendingTopics,
        total_topics: allTopics.length,
        completed_topics: allTopics.length - pendingTopics.length,
      };
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Find the earliest exam date to limit scheduling
    // We should NOT schedule ANY course topics beyond its exam date
    const earliestExamDate = Math.min(...courseData.filter(c => c.days_until_exam > 0).map(c => c.days_until_exam));
    const latestExamDate = Math.max(...courseData.map(c => c.days_until_exam));
    
    // Only schedule up to the earliest exam (not beyond)
    // For courses with later exams, they'll still get scheduled but only up to their exam dates
    const planDays = Math.min(Math.max(earliestExamDate, 1), 30);

    // Generate available dates (excluding days off) - only dates BEFORE exams
    const availableDates: string[] = [];
    for (let i = 0; i < planDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dateStr = date.toISOString().split('T')[0];
      
      if (!daysOff.includes(dayOfWeek) && !daysOff.includes(dateStr)) {
        availableDates.push(dateStr);
      }
    }

    // Create a map of course -> available dates (only dates before that course's exam)
    const courseDateConstraints = courseData.map(c => ({
      courseId: c.id,
      courseTitle: c.title,
      examDate: c.exam_date,
      availableDates: availableDates.filter(d => d < c.exam_date),
    }));

    logStep('Available dates calculated', { count: availableDates.length });

    // Calculate total required hours vs available hours
    const totalRequiredHours = courseData.reduce((sum, c) => 
      sum + c.topics.reduce((tSum: number, t: any) => tSum + (t.estimated_hours || 1), 0), 0
    );
    const totalAvailableHours = availableDates.length * dailyStudyHours;
    const coverageRatio = totalAvailableHours / totalRequiredHours;
    const isOverloaded = coverageRatio < 1;

    logStep('Time analysis', { 
      totalRequiredHours, 
      totalAvailableHours, 
      coverageRatio: coverageRatio.toFixed(2),
      isOverloaded 
    });

    // Build AI prompt for smart scheduling with MANDATORY ALL-TOPICS inclusion and STRICT DEPENDENCY HANDLING
    const systemPrompt = `You are an expert study planner AI. Your task is to create an optimal study schedule that maximizes learning efficiency.

CRITICAL MANDATORY RULES:
1. Return ONLY valid JSON - no markdown, no code blocks
2. **EVERY SINGLE TOPIC MUST BE INCLUDED** - NO topic can be left out under any circumstances
3. If there's not enough time, COMPRESS study hours proportionally (minimum 0.25 hours per topic)
4. **STRICT DEPENDENCY RULE**: A topic with prerequisites MUST be scheduled AFTER all its prerequisites are completed
5. Apply spaced repetition for high-importance topics if time allows
6. Balance workload across available days as evenly as possible
7. Schedule high-priority topics earlier, closer to today

CRITICAL TOPIC DEPENDENCY RULES (MUST FOLLOW):
1. BEFORE scheduling any topic, check its "prerequisites" array
2. ALL prerequisites MUST be scheduled on EARLIER days than the dependent topic
3. If a topic has prerequisites, it CANNOT appear on Day 1 unless ALL prerequisites are also on Day 1 with EARLIER order_index
4. Use order_index to control sequence within a day: prerequisites get LOWER order_index values
5. Example: If Topic A depends on Topic B:
   - Topic B MUST be scheduled before Topic A
   - If same day: Topic B order_index MUST be less than Topic A order_index
   - If different days: Topic B's date MUST be earlier than Topic A's date
6. Build a topological sort of topics based on dependencies, then schedule in that order

DEPENDENCY VALIDATION CHECKLIST:
- For each topic with prerequisites[], verify ALL prerequisite topic_ids are already scheduled earlier
- Never schedule a foundation topic AFTER the advanced topic that depends on it
- When allocating within a day, prerequisites get slots 0, 1, 2... and dependents get later slots

TIME COMPRESSION RULES (when overloaded):
- Calculate compression ratio: available_hours / required_hours
- Apply ratio to each topic's estimated hours
- Minimum study time per topic: 0.25 hours (15 minutes)
- Example: If ratio is 0.5, a 2-hour topic becomes 1 hour

COVERAGE RATIO: ${coverageRatio.toFixed(2)}
${isOverloaded ? `WARNING: Only ${Math.round(coverageRatio * 100)}% of ideal study time is available. You MUST compress study hours proportionally.` : 'Sufficient time available for full study plan.'}

OUTPUT SCHEMA:
{
  "schedule": [
    {
      "date": "YYYY-MM-DD",
      "topic_id": "uuid",
      "course_id": "uuid",
      "hours": number (0.25 to 3, compressed if needed),
      "is_review": boolean,
      "order_index": number (order within the day, starting from 0 - prerequisites get lower values)
    }
  ],
  "warnings": ["array of scheduling concerns - INCLUDE if overloaded or dependencies were complex"],
  "overload_days": ["dates where workload exceeds original capacity"],
  "coverage_ratio": number (0 to 1+),
  "total_topics_scheduled": number (MUST equal total topics provided)
}

SCHEDULING PRIORITIES (in order of importance):
1. **ALL topics MUST be scheduled** - this is non-negotiable
2. **DEPENDENCIES MUST BE RESPECTED** - prerequisites before dependents, ALWAYS
3. Closer exam dates get higher priority
4. Higher importance topics scheduled earlier within dependency constraints
5. Distribute difficult topics across different days when possible`;

    const userPrompt = `Create a study schedule with these constraints:

AVAILABLE STUDY DATES: ${JSON.stringify(availableDates)}
DAILY STUDY CAPACITY: ${dailyStudyHours} hours
TODAY: ${todayStr}
TOTAL AVAILABLE HOURS: ${totalAvailableHours}
TOTAL REQUIRED HOURS: ${totalRequiredHours}

COURSE-SPECIFIC DATE CONSTRAINTS (CRITICAL - topics MUST be scheduled BEFORE their course exam date):
${JSON.stringify(courseDateConstraints, null, 2)}

COURSES AND TOPICS (ALL MUST BE SCHEDULED):
${JSON.stringify(courseData, null, 2)}

CRITICAL REQUIREMENTS:
1. Schedule EVERY topic from EVERY course - count them and verify all are included
2. Total topics to schedule: ${courseData.reduce((sum, c) => sum + c.topics.length, 0)}
3. **NEVER schedule a topic on or after its course's exam date** - this is the most important rule!
4. ${isOverloaded ? `Time is LIMITED - compress study hours proportionally. Target ${Math.round(coverageRatio * 100)}% of estimated time per topic.` : 'Time is sufficient - use full estimated hours.'}
5. Prioritize topics based on exam proximity: nearest exam = highest priority
6. Add warnings if any day exceeds ${dailyStudyHours * 1.5} hours`;

    logStep('Calling AI for scheduling');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep('AI API error', { status: response.status, error: errorText });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI');
    }

    logStep('AI response received', { length: content.length });

    // Parse AI response
    let parsed: { 
      schedule: ScheduledItem[], 
      warnings?: string[], 
      overload_days?: string[],
      coverage_ratio?: number,
      total_topics_scheduled?: number 
    };
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      
      parsed = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      logStep('Failed to parse AI response', { error: parseError });
      throw new Error('AI returned invalid format');
    }

    if (!Array.isArray(parsed.schedule)) {
      throw new Error('Invalid response: missing schedule array');
    }

    // Verify all topics were scheduled
    const totalTopicsProvided = courseData.reduce((sum, c) => sum + c.topics.length, 0);
    const uniqueTopicsScheduled = new Set(parsed.schedule.filter(s => !s.is_review).map(s => s.topic_id)).size;
    
    logStep('Schedule parsed', { 
      items: parsed.schedule.length, 
      uniqueTopics: uniqueTopicsScheduled,
      totalProvided: totalTopicsProvided
    });

    // Generate warnings if topics are missing
    const scheduleWarnings: string[] = parsed.warnings || [];
    if (uniqueTopicsScheduled < totalTopicsProvided) {
      scheduleWarnings.push(`Warning: Only ${uniqueTopicsScheduled}/${totalTopicsProvided} topics were scheduled. Some may have been missed.`);
    }
    if (isOverloaded) {
      scheduleWarnings.push(`Time constraint: Only ${Math.round(coverageRatio * 100)}% of ideal study time available. Study hours have been compressed.`);
      scheduleWarnings.push(`You need ${totalRequiredHours} hours but only have ${totalAvailableHours} hours available.`);
    }

    // Delete existing plan days (future only)
    await supabase
      .from('study_plan_days')
      .delete()
      .eq('user_id', user.id)
      .gte('date', today.toISOString().split('T')[0]);

    // Group schedule by date
    const scheduleByDate = new Map<string, ScheduledItem[]>();
    for (const item of parsed.schedule) {
      if (!scheduleByDate.has(item.date)) {
        scheduleByDate.set(item.date, []);
      }
      scheduleByDate.get(item.date)!.push(item);
    }

    // Create plan days and items
    let totalDays = 0;
    let totalItems = 0;

    for (const [dateStr, items] of scheduleByDate) {
      const totalHours = items.reduce((sum, i) => sum + (i.hours || 0.5), 0);
      
      const { data: planDay, error: dayError } = await supabase
        .from('study_plan_days')
        .insert({
          user_id: user.id,
          date: dateStr,
          total_hours: totalHours,
          is_day_off: false,
          plan_version: 1,
        })
        .select()
        .single();

      if (dayError) {
        logStep('Failed to create plan day', { error: dayError });
        continue;
      }

      totalDays++;

      // Sort items by order_index
      items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const { error: itemError } = await supabase
          .from('study_plan_items')
          .insert({
            user_id: user.id,
            plan_day_id: planDay.id,
            course_id: item.course_id,
            topic_id: item.topic_id,
            hours: item.hours || 0.5,
            order_index: i,
            is_completed: false,
          });

        if (!itemError) {
          totalItems++;
        }
      }
    }

    logStep('Plan created', { days: totalDays, items: totalItems });

    // Create AI job record
    await supabase.from('ai_jobs').insert({
      user_id: user.id,
      job_type: 'smart_plan',
      status: 'completed',
      result_json: {
        days_created: totalDays,
        items_created: totalItems,
        warnings: scheduleWarnings,
        overload_days: parsed.overload_days || [],
        coverage_ratio: coverageRatio,
        total_required_hours: totalRequiredHours,
        total_available_hours: totalAvailableHours,
        topics_scheduled: uniqueTopicsScheduled,
        topics_provided: totalTopicsProvided,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan_days: totalDays,
        plan_items: totalItems,
        warnings: scheduleWarnings,
        overload_days: parsed.overload_days || [],
        courses_included: courseData.length,
        coverage_ratio: coverageRatio,
        total_required_hours: totalRequiredHours,
        total_available_hours: totalAvailableHours,
        is_overloaded: isOverloaded,
        topics_scheduled: uniqueTopicsScheduled,
        topics_provided: totalTopicsProvided,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
