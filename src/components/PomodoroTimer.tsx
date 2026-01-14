import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface PlanItem {
  id: string;
  course_id: string;
  topic_id: string | null;
  hours: number;
  is_completed: boolean;
  course?: {
    id: string;
    title: string;
    color: string;
  };
  topic?: {
    id: string;
    title: string;
  };
}

interface PomodoroTimerProps {
  planItems?: PlanItem[];
  onTopicStatusChange?: (itemId: string, isCompleted: boolean) => void;
  compact?: boolean;
}

const TIMER_SETTINGS = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_CONFIG = {
  work: {
    label: 'Focus',
    labelAr: 'تركيز',
    icon: BookOpen,
  },
  shortBreak: {
    label: 'Short Break',
    labelAr: 'استراحة قصيرة',
    icon: Coffee,
  },
  longBreak: {
    label: 'Long Break',
    labelAr: 'استراحة طويلة',
    icon: Coffee,
  },
};

export function PomodoroTimer({ planItems = [], onTopicStatusChange, compact = false }: PomodoroTimerProps) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SETTINGS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSessionDuration, setCurrentSessionDuration] = useState(0);
  const { language, t } = useLanguage();
  
  // New states for topic selection and completion
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentWorkingItem, setCurrentWorkingItem] = useState<PlanItem | null>(null);
  
  // Filter available items (incomplete items with topics)
  const availableItems = planItems.filter(item => !item.is_completed && item.topic);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleScAHIveli8AEn7NtHEjABN3zaRVJQAXfM6mWCcAEXvKolglABl+y6VYJgARfMqiWCUAGH7Lo1gmABF8yqJYJQAYfsuiWCYAEXzKolglABh+y6JYJgARfMqiWCUAGH7LolglABF8yqJYJQAYfsuiWCYAEXzKolglABh+y6JYJgARfMqiWCUA');
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        if (mode === 'work') {
          setCurrentSessionDuration((prev) => prev + 1);
        }
      }, 1000);
    } else if (timeLeft === 0) {
      audioRef.current?.play().catch(() => {});
      
      if (mode === 'work') {
        saveSession(currentSessionDuration);
        setCurrentSessionDuration(0);

        const newSessions = sessionsCompleted + 1;
        setSessionsCompleted(newSessions);

        // If working on a topic, show completion dialog
        if (currentWorkingItem) {
          setShowCompletionDialog(true);
        } else {
          // Auto-switch to break mode if no topic is being tracked
          if (newSessions % 4 === 0) {
            setMode('longBreak');
            setTimeLeft(TIMER_SETTINGS.longBreak);
          } else {
            setMode('shortBreak');
            setTimeLeft(TIMER_SETTINGS.shortBreak);
          }
        }
      } else {
        // Break ended - if we have a current item still in progress, continue with it
        setMode('work');
        setTimeLeft(TIMER_SETTINGS.work);
      }
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, timeLeft, mode, sessionsCompleted]);

  const saveSession = async (durationInSeconds: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('pomodoro_sessions').insert({
        user_id: user.id,
        duration_minutes: Math.round(durationInSeconds / 60),
        session_type: 'focus'
      });

      if (error) throw error;
      toast.success(language === 'ar' ? 'تم تسجيل الجلسة!' : 'Session recorded!');
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle start button - show topic selector if items available
  const handleStart = () => {
    if (mode === 'work' && availableItems.length > 0 && !currentWorkingItem) {
      setShowTopicSelector(true);
    } else {
      setIsRunning(true);
    }
  };
  
  // Start timer with selected topic
  const handleStartWithTopic = () => {
    if (selectedItemId) {
      const item = availableItems.find(i => i.id === selectedItemId);
      if (item) {
        setCurrentWorkingItem(item);
        // Update topic status to in_progress
        if (item.topic_id && onTopicStatusChange) {
          // We'll handle this via the parent component
        }
      }
    }
    setShowTopicSelector(false);
    setIsRunning(true);
  };
  
  // Start without selecting a topic
  const handleStartWithoutTopic = () => {
    setShowTopicSelector(false);
    setIsRunning(true);
  };
  
  // Handle completion - mark topic as done
  const handleTopicCompleted = () => {
    if (currentWorkingItem && onTopicStatusChange) {
      onTopicStatusChange(currentWorkingItem.id, true);
      toast.success(
        language === 'ar' 
          ? `أحسنت! تم إكمال "${currentWorkingItem.topic?.title}"` 
          : `Great job! "${currentWorkingItem.topic?.title}" completed!`
      );
    }
    setCurrentWorkingItem(null);
    setShowCompletionDialog(false);
    
    // Switch to break
    const newSessions = sessionsCompleted;
    if (newSessions % 4 === 0) {
      setMode('longBreak');
      setTimeLeft(TIMER_SETTINGS.longBreak);
    } else {
      setMode('shortBreak');
      setTimeLeft(TIMER_SETTINGS.shortBreak);
    }
  };
  
  // Handle not completed - suggest break and continue with same topic
  const handleTopicNotCompleted = () => {
    setShowCompletionDialog(false);
    toast.info(
      language === 'ar' 
        ? 'لا بأس! خذ استراحة وستستمر في نفس الموضوع بعدها.' 
        : "No problem! Take a break and you'll continue with the same topic after."
    );
    
    // Switch to break, keeping the current working item
    const newSessions = sessionsCompleted;
    if (newSessions % 4 === 0) {
      setMode('longBreak');
      setTimeLeft(TIMER_SETTINGS.longBreak);
    } else {
      setMode('shortBreak');
      setTimeLeft(TIMER_SETTINGS.shortBreak);
    }
  };
  
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(TIMER_SETTINGS[mode]);
    setCurrentSessionDuration(0);
    setCurrentWorkingItem(null);
  };

  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(TIMER_SETTINGS[newMode]);
    setIsRunning(false);
    setCurrentSessionDuration(0);
  };

  const progress = ((TIMER_SETTINGS[mode] - timeLeft) / TIMER_SETTINGS[mode]) * 100;
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // Compact size for sidebar placement
  const timerSize = compact ? 140 : 180;
  const compactStrokeWidth = compact ? 5 : 6;
  const compactRadius = (timerSize - compactStrokeWidth) / 2;
  const compactCircumference = compactRadius * 2 * Math.PI;
  const compactOffset = compactCircumference - (progress / 100) * compactCircumference;

  return (
    <>
      <LiquidGlassCard className={compact ? "p-4" : "p-6"}>
        <div className="text-center">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <h2 className="font-medium">
              {language === 'ar' ? 'مؤقت بومودورو' : 'Pomodoro Timer'}
            </h2>
          </div>
          
          {/* Current Working Topic Indicator */}
          {currentWorkingItem && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentWorkingItem.course?.color || 'hsl(var(--primary))' }}
                />
                <span className="text-sm font-medium truncate">
                  {currentWorkingItem.topic?.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentWorkingItem.course?.title}
              </p>
            </div>
          )}

          {/* Mode Selector - Simplified */}
          <div className={cn(
            "flex justify-center gap-1 mb-4 p-1 bg-muted/30 rounded-lg",
            compact && "flex-wrap"
          )}>
            {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  mode === m 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {language === 'ar' ? MODE_CONFIG[m].labelAr : MODE_CONFIG[m].label}
              </button>
            ))}
          </div>

          {/* Radial Progress Timer */}
          <div className="relative mb-4 flex justify-center">
            <div className="relative">
              <svg width={timerSize} height={timerSize} className="transform -rotate-90">
                <circle
                  cx={timerSize / 2}
                  cy={timerSize / 2}
                  r={compactRadius}
                  stroke="currentColor"
                  strokeWidth={compactStrokeWidth}
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx={timerSize / 2}
                  cy={timerSize / 2}
                  r={compactRadius}
                  strokeWidth={compactStrokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  className="stroke-primary transition-all duration-1000"
                  style={{
                    strokeDasharray: compactCircumference,
                    strokeDashoffset: compactOffset,
                  }}
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={cn(
                  "font-mono font-medium text-foreground",
                  compact ? "text-3xl" : "text-4xl"
                )} dir="ltr">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' ? config.labelAr : config.label}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-2 mb-4">
            {!isRunning ? (
              <Button 
                onClick={handleStart} 
                className="gap-2 h-10 px-6"
              >
                <Play className="w-4 h-4" />
                {language === 'ar' ? 'ابدأ' : 'Start'}
              </Button>
            ) : (
              <Button 
                onClick={handlePause} 
                variant="secondary" 
                className="gap-2 h-10 px-6"
              >
                <Pause className="w-4 h-4" />
                {language === 'ar' ? 'إيقاف' : 'Pause'}
              </Button>
            )}
            <Button 
              onClick={handleReset} 
              variant="ghost" 
              size="icon"
              className="h-10 w-10"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>

          {/* Sessions Counter */}
          <div className="text-xs text-muted-foreground">
            {language === 'ar' ? 'الجلسات المكتملة' : 'Sessions completed'}: 
            <span className="font-medium text-foreground ms-1">{sessionsCompleted}</span>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Topic Selection Dialog */}
      <Dialog open={showTopicSelector} onOpenChange={setShowTopicSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'اختر موضوعاً للدراسة' : 'Select a Topic to Study'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'اختر موضوعاً من خطتك اليومية لتتبع تقدمك.'
                : 'Choose a topic from your daily plan to track your progress.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Select value={selectedItemId || ''} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر موضوعاً...' : 'Select a topic...'} />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.course?.color || 'hsl(var(--primary))' }}
                      />
                      <span className="truncate">{item.topic?.title}</span>
                      <span className="text-muted-foreground text-xs">
                        ({item.course?.title})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleStartWithoutTopic}
              className="w-full sm:w-auto"
            >
              {language === 'ar' ? 'ابدأ بدون موضوع' : 'Start without topic'}
            </Button>
            <Button 
              onClick={handleStartWithTopic}
              disabled={!selectedItemId}
              className="w-full sm:w-auto"
            >
              {language === 'ar' ? 'ابدأ الدراسة' : 'Start studying'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Confirmation Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>🎉</span>
              {language === 'ar' ? 'انتهى الوقت!' : 'Time\'s up!'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `هل أكملت دراسة "${currentWorkingItem?.topic?.title}"؟`
                : `Did you finish studying "${currentWorkingItem?.topic?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          
          {currentWorkingItem && (
            <div className="py-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: currentWorkingItem.course?.color || 'hsl(var(--primary))' }}
                  />
                  <div>
                    <p className="font-medium">{currentWorkingItem.topic?.title}</p>
                    <p className="text-sm text-muted-foreground">{currentWorkingItem.course?.title}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleTopicNotCompleted}
              className="w-full sm:w-auto gap-2"
            >
              <XCircle className="w-4 h-4" />
              {language === 'ar' ? 'لم أنتهِ بعد' : 'Not yet'}
            </Button>
            <Button 
              onClick={handleTopicCompleted}
              className="w-full sm:w-auto gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {language === 'ar' ? 'نعم، أكملته!' : 'Yes, done!'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
