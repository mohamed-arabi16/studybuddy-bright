import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreateCourseDialog } from "@/components/CreateCourseDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { BookOpen, Calendar, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CourseCardSkeletonGrid } from "@/components/ui/course-card-skeleton";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

type Course = {
  id: string;
  title: string;
  exam_date: string | null;
  status: string;
  color: string | null;
  topics?: { id: string; status: string }[];
};

export default function Courses() {
  const { t, language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          exam_date,
          status,
          color,
          topics (id, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const getDaysUntilExam = (examDate: string | null) => {
    if (!examDate) return null;
    const diff = Math.ceil((new Date(examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">{t('courses')}</h1>
        </div>
        <CourseCardSkeletonGrid count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('courses')}</h1>
        <CreateCourseDialog onCourseCreated={fetchCourses} />
      </div>

      {courses.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={BookOpen}
            title={t('noCoursesTitle')}
            description={t('noCoursesDesc')}
            className="py-16"
          >
            <CreateCourseDialog onCourseCreated={fetchCourses} />
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const daysLeft = getDaysUntilExam(course.exam_date);
            const completedTopics = course.topics?.filter(t => t.status === 'done').length || 0;
            const totalTopics = course.topics?.length || 0;
            const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

            return (
              <Card
                key={course.id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
                onClick={() => navigate(`/app/courses/${course.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-3 h-3 rounded-full mt-1"
                      style={{ backgroundColor: course.color || '#6366f1' }}
                    />
                    {daysLeft !== null && (
                      <Badge 
                        variant={daysLeft <= 7 ? 'destructive' : daysLeft <= 14 ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {daysLeft > 0 ? `${daysLeft} ${t('daysLeft')}` : daysLeft === 0 ? t('todayExclamation') : t('ended')}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {course.exam_date
                      ? format(new Date(course.exam_date), "d MMMM yyyy", { locale: language === 'ar' ? ar : undefined })
                      : t('noExamDate')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('progress')}
                      </span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('completedTopicsCount').replace('{completed}', completedTopics.toString()).replace('{total}', totalTopics.toString())}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
