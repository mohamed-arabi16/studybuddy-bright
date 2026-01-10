import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface DailyTopic {
  allocation_id: string;
  topic_id: string;
  topic_title: string;
  course_title: string;
  is_completed: boolean;
}

export default function TodayAllocation() {
  const [tasks, setTasks] = useState<DailyTopic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodayTasks = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get allocations for today for this user's courses
      const { data: allocations, error } = await supabase
        .from("allocations")
        .select(`
          id,
          topics_json,
          course:courses!inner(id, title, user_id)
        `)
        .eq("date", todayStr);

      if (error) throw error;

      // Filter by user and aggregate topics
      const userAllocations = (allocations || []).filter((a: any) => a.course?.user_id === user.id);
      
      const topicIds: string[] = [];
      userAllocations.forEach((a: any) => {
          if (Array.isArray(a.topics_json)) {
              topicIds.push(...a.topics_json);
          }
      });

      if (topicIds.length === 0) {
          setTasks([]);
          return;
      }

      // Fetch topic details
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("id, title, is_completed")
        .in("id", topicIds);

      if (topicsError) throw topicsError;

      // Map back to display structure
      const displayTasks: DailyTopic[] = [];
      userAllocations.forEach((a: any) => {
         const courseTitle = a.course.title;
         const ids = Array.isArray(a.topics_json) ? a.topics_json : [];
         ids.forEach((tid: string) => {
             const tInfo = topicsData?.find(t => t.id === tid);
             if (tInfo) {
                 displayTasks.push({
                     allocation_id: a.id,
                     topic_id: tInfo.id,
                     topic_title: tInfo.title,
                     course_title: courseTitle,
                     is_completed: tInfo.is_completed || false
                 });
             }
         });
      });

      setTasks(displayTasks);

    } catch (error) {
      console.error("Error fetching today tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayTasks();
  }, []);

  const toggleTask = async (topicId: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;

      // Optimistic update
      setTasks(prev => prev.map(t => t.topic_id === topicId ? { ...t, is_completed: newStatus } : t));

      const { error } = await supabase
        .from("topics")
        .update({ 
          is_completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null
        })
        .eq("id", topicId);

      if (error) {
          console.error("Failed to update status");
          // Revert on error
          setTasks(prev => prev.map(t => t.topic_id === topicId ? { ...t, is_completed: currentStatus } : t));
      }
  };

  if (loading) return <Loader2 className="animate-spin" />;

  if (tasks.length === 0) {
      return (
          <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                  No tasks scheduled for today. Check your course plans!
              </CardContent>
          </Card>
      );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.topic_id} className="flex items-center p-4">
           <Checkbox
                checked={task.is_completed}
                onCheckedChange={() => toggleTask(task.topic_id, task.is_completed)}
                className="mr-4 h-6 w-6"
           />
           <div className="flex-1">
               <h4 className={`font-semibold ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                   {task.topic_title}
               </h4>
               <p className="text-sm text-muted-foreground">{task.course_title}</p>
           </div>
        </Card>
      ))}
    </div>
  );
}