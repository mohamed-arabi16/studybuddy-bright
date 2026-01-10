import { useStudySession } from '@/hooks/useStudySession';
import { SessionBanner } from '@/components/SessionBanner';
import { TodayOverview } from '@/components/TodayOverview';
import { ExamCountdownNew } from '@/components/ExamCountdownNew';
import { ProgressDashboard } from '@/components/ProgressDashboard';
import { ScheduleTableNew } from '@/components/ScheduleTableNew';
import { StudySummarySection } from '@/components/StudySummarySection';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Schedule = () => {
  const { 
    sessionCode, 
    completedTasks, 
    isLoading, 
    isSyncing, 
    toggleTask, 
    copyShareableLink 
  } = useStudySession();
  const { t, dir } = useLanguage();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            📚 جدول المذاكرة
          </h1>
          <p className="text-muted-foreground">خطة دراسية مفصّلة للامتحانات</p>
        </header>

        {/* Session Banner */}
        <SessionBanner 
          sessionCode={sessionCode}
          isSyncing={isSyncing}
          onCopyLink={copyShareableLink}
        />

        {/* Pomodoro Timer */}
        <PomodoroTimer />

        {/* Today's Overview */}
        <TodayOverview 
          completedTasks={completedTasks}
          onToggleTask={toggleTask}
        />

        {/* Exam Countdowns */}
        <ExamCountdownNew />

        {/* Progress Dashboard */}
        <ProgressDashboard completedTasks={completedTasks} />

        {/* Detailed Schedule (Collapsible) */}
        <ScheduleTableNew 
          completedTasks={completedTasks}
          onToggleTask={toggleTask}
        />

        {/* Study Summary Section - Moved to bottom */}
        <StudySummarySection />

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in">
          حظاً موفقاً في امتحاناتك! 📚
        </footer>
      </div>
    </div>
  );
};

export default Schedule;
