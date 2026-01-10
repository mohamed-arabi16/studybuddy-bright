import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

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

export function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(TIMER_SETTINGS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSessionDuration, setCurrentSessionDuration] = useState(0);
  const { language, t } = useLanguage();

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

        if (newSessions % 4 === 0) {
          setMode('longBreak');
          setTimeLeft(TIMER_SETTINGS.longBreak);
        } else {
          setMode('shortBreak');
          setTimeLeft(TIMER_SETTINGS.shortBreak);
        }
      } else {
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

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(TIMER_SETTINGS[mode]);
    setCurrentSessionDuration(0);
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
  
  // SVG circle calculations
  const size = 180;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <LiquidGlassCard className="p-6">
      <div className="text-center">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <h2 className="font-medium">
            {language === 'ar' ? 'مؤقت بومودورو' : 'Pomodoro Timer'}
          </h2>
        </div>

        {/* Mode Selector - Simplified */}
        <div className="flex justify-center gap-1 mb-6 p-1 bg-muted/30 rounded-lg">
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
        <div className="relative mb-6 flex justify-center">
          <div className="relative">
            <svg width={size} height={size} className="transform -rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                className="stroke-primary transition-all duration-1000"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: offset,
                }}
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-mono font-medium text-foreground" dir="ltr">
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
  );
}
