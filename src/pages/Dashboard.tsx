import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Sparkles, ArrowRight, ArrowLeft, Plus, GraduationCap, Target, Sun, Moon, Sunset,
  Lightbulb, ListTodo, TrendingUp, RefreshCw, Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { ExamCountdownCard } from '@/components/ExamCountdownCard';
import { OverallProgressSection } from '@/components/OverallProgressSection';
import { CollapsibleInfoSection } from '@/components/CollapsibleInfoSection';
import { StudyTipsSection } from '@/components/StudyTipsSection';
import { supabase } from '@/integrations/supabase/client';
import { usePlanGeneration } from '@/hooks/usePlanGeneration';
import { useCredits } from '@/hooks/useCredits';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  exam_date: string | null;
  color: string;
  topics: { id: string; status: string }[];
}

export default function Dashboard() {
  const [firstName, setFirstName] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { t, dir, language } = useLanguage();
  const { toast } = useToast();
  const { refresh: refreshCredits } = useCredits();
  
  const { 
    planDays, 
    isLoading: planLoading, 
    generatePlan: generatePlanOriginal,
    isGenerating,
    toggleItemCompletion 
  } = usePlanGeneration();

  // Wrap generatePlan to refresh credits after generation
  const generatePlan = async () => {
    const result = await generatePlanOriginal();
    await refreshCredits();
    return result;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: t('goodMorning'), icon: Sun };
    if (hour < 17) return { text: t('goodAfternoon'), icon: Sunset };
    return { text: t('goodEvening'), icon: Moon };
  };

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch name from profiles table - prioritize full_name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        // Use full_name first, then display_name, then email prefix as fallback
        setFirstName(profileData?.full_name || profileData?.display_name || user.email?.split('@')[0] || '');

        const { data: coursesData } = await supabase
          .from('courses')
          .select(`
            id,
            title,
            exam_date,
            color,
            topics (id, status)
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('exam_date', { ascending: true });

        setCourses(coursesData || []);

        // Check calendar connection status
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: calendarStatus } = await supabase.functions.invoke('google-calendar-auth', {
              body: { action: 'status' }
            });
            setCalendarConnected(calendarStatus?.connected || false);
          }
        } catch {
          // Silently fail - calendar not connected
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const todayPlan = planDays.find(d => {
    const planDate = new Date(d.date);
    const today = new Date();
    return planDate.toDateString() === today.toDateString();
  });

  // Detect if today is a day off
  const isTodayDayOff = todayPlan?.is_day_off === true;

  // Find next study day with items
  const nextStudyDay = planDays.find(d => {
    const planDate = new Date(d.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return planDate > today && !d.is_day_off && d.items.length > 0;
  });

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const handleQuickSync = async () => {
    try {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-calendar');
      
      if (error) throw error;
      
      toast({
        title: t('syncSuccess'),
        description: t('eventsCreated').replace('{count}', String(data.eventsCreated)),
      });
    } catch (error) {
      console.error('Quick sync error:', error);
      toast({
        title: t('error'),
        description: 'Failed to sync calendar',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Courses with upcoming exams (sorted by date)
  const upcomingExams = courses
    .filter(c => c.exam_date && new Date(c.exam_date) > new Date())
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime());

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Welcome screen for new users
  if (courses.length === 0) {
    return (
      <div className="space-y-8" dir={dir}>
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <GraduationCap className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            {t('welcomeTitle')}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            {t('welcomeSubtitle')}
          </p>

          <LiquidGlassCard className="p-8 max-w-lg mx-auto mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-5 h-5 text-primary" strokeWidth={1.5} />
              <h2 className="text-lg font-medium">{t('howToStart')}</h2>
            </div>
            
            <div className="space-y-4 text-start">
              {[
                { num: '1', title: t('addFirstCourseStep'), desc: t('addFirstCourseDesc'), active: true },
                { num: '2', title: t('addTopicsStep'), desc: t('addTopicsDesc'), active: false },
                { num: '3', title: t('getPlanStep'), desc: t('getPlanDesc'), active: false }
              ].map((step) => (
                <div 
                  key={step.num}
                  className={`flex items-start gap-4 p-4 rounded-xl ${
                    step.active 
                      ? 'bg-primary/5 border border-primary/20' 
                      : 'bg-muted/20 border border-border/30'
                  }`}
                >
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    {step.num}
                  </div>
                  <div>
                    <h3 className={`font-medium mb-1 ${!step.active && 'text-muted-foreground'}`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </LiquidGlassCard>

          <Button asChild size="lg" className="h-12 px-6">
            <Link to="/app/courses">
              <Plus className="w-4 h-4 me-2" />
              {t('addFirstCourse')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const completedTodayItems = todayPlan?.items.filter(i => i.is_completed).length || 0;
  const totalTodayItems = todayPlan?.items.length || 0;
  const progressPercent = totalTodayItems > 0 ? (completedTodayItems / totalTodayItems) * 100 : 0;

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GreetingIcon className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{greeting.text}، {firstName}</h1>
            <p className="text-sm text-muted-foreground">{t('letsStudy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {calendarConnected && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 gap-2"
              onClick={handleQuickSync}
              disabled={syncing}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {t('syncToCalendar')}
            </Button>
          )}
          <Button asChild className="h-9">
            <Link to="/app/courses">
              <Plus className="w-4 h-4 me-2" />
              {t('newCourse')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Exam Countdown Cards - Top Priority Section */}
      {upcomingExams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{t('upcomingExams')} ({upcomingExams.length})</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingExams.slice(0, 3).map((course, index) => (
              <ExamCountdownCard 
                key={course.id} 
                course={course} 
                isFirst={index === 0}
              />
            ))}
          </div>
          {upcomingExams.length > 3 && (
            <Button asChild variant="ghost" size="sm" className="h-8">
              <Link to="/app/courses" className="gap-2">
                {t('viewAllExams').replace('{count}', String(upcomingExams.length))}
                <ArrowIcon className="w-3 h-3" />
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Main Grid - Today's Plan + Pomodoro Timer + Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Plan */}
        <LiquidGlassCard className="overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-border/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListTodo className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <h2 className="font-medium">{t('todayPlan')}</h2>
              {todayPlan && totalTodayItems > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {completedTodayItems}/{totalTodayItems}
                </Badge>
              )}
            </div>
            {planDays.length === 0 && courses.length > 0 && (
              <Button 
                onClick={() => generatePlan()} 
                disabled={isGenerating}
                size="sm"
                className="h-8 gap-2"
              >
                {isGenerating ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {t('createPlan')}
              </Button>
            )}
          </div>
          
          <div className="p-4">
            {planLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todayPlan && todayPlan.items.length > 0 ? (
              <div className="space-y-3">
                {/* Progress */}
                <div className="mb-4">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Tasks */}
                {todayPlan.items.map(item => (
                  <div
                    key={item.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                      ${item.is_completed 
                        ? 'bg-success/5 border-success/20' 
                        : 'bg-card/30 border-border/30 hover:border-primary/20'
                      }
                    `}
                  >
                    <Checkbox
                      checked={item.is_completed}
                      onCheckedChange={(checked) => 
                        toggleItemCompletion(item.id, checked as boolean)
                      }
                    />
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.course?.color || 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.topic?.title || t('generalStudy')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.course?.title}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.hours}h
                    </span>
                  </div>
                ))}

                <Button asChild variant="ghost" className="w-full mt-2 h-9 text-sm">
                  <Link to="/app/plan" className="gap-2">
                    {t('viewFullPlan')}
                    <ArrowIcon className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            ) : isTodayDayOff ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Coffee className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium mb-1">{t('dayOff')}</h3>
                <p className="text-sm text-muted-foreground mb-3">{t('enjoyYourBreak')}</p>
                {nextStudyDay && (
                  <p className="text-xs text-muted-foreground">
                    {t('nextStudyDay')}: {new Date(nextStudyDay.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title={t('noPlanYet')}
                description={t('noPlanDesc')}
                action={{
                  label: t('createPlan'),
                  onClick: () => generatePlan(),
                }}
              />
            )}
          </div>
        </LiquidGlassCard>

        {/* Pomodoro Timer - Now in main grid */}
        <div className="md:col-span-1">
          <PomodoroTimer 
            planItems={todayPlan?.items}
            onTopicStatusChange={toggleItemCompletion}
            compact={false}
          />
        </div>

        {/* Overall Progress Section */}
        <div className="md:col-span-2 lg:col-span-1">
          <OverallProgressSection courses={courses} />
        </div>
      </div>

      {/* Collapsible Information Sections */}
      <div className="space-y-3">
        {/* Study Tips */}
        <CollapsibleInfoSection 
          title={t('studyTipsTitle')} 
          icon={Lightbulb}
          badge={t('tipsCount').replace('{count}', '5')}
          badgeVariant="success"
        >
          <StudyTipsSection />
        </CollapsibleInfoSection>

        {/* Upcoming Schedule Summary */}
        {planDays.length > 0 && (
          <CollapsibleInfoSection 
            title={t('detailedSchedule').replace('{days}', String(planDays.length))}
            icon={Calendar}
          >
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {planDays.slice(0, 7).map(day => {
                const dayDate = new Date(day.date);
                const isDayToday = dayDate.toDateString() === new Date().toDateString();
                const completedCount = day.items.filter(i => i.is_completed).length;
                
                return (
                  <div 
                    key={day.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isDayToday ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-medium">
                          {dayDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {isDayToday && <Badge variant="secondary" className="ms-2 text-[10px]">{t('today')}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{completedCount}/{day.items.length} {t('tasks')}</span>
                      <span>•</span>
                      <span>{day.total_hours}{t('hours')}</span>
                    </div>
                  </div>
                );
              })}
              {planDays.length > 7 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  {t('moreDays').replace('{count}', String(planDays.length - 7))}
                </p>
              )}
            </div>
          </CollapsibleInfoSection>
        )}
      </div>
    </div>
  );
}
