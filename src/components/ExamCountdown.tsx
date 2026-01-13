import { useState, useEffect } from 'react';
import { exams } from '@/data/studySchedule';
import { TimeLeft, getTimeLeft } from '@/lib/timeUtils';

export function ExamCountdown() {
  const [timesLeft, setTimesLeft] = useState<Record<string, TimeLeft>>({});

  useEffect(() => {
    const calculateTimes = () => {
      const times: Record<string, TimeLeft> = {};
      exams.forEach(exam => {
        times[exam.id] = getTimeLeft(exam.date);
      });
      setTimesLeft(times);
    };

    calculateTimes();
    const timer = setInterval(calculateTimes, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {exams.map(exam => {
        const timeLeft = timesLeft[exam.id] || { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
        const isUrgent = timeLeft.days < 2 && timeLeft.total > 0;
        const isPast = timeLeft.total <= 0;

        const examTime = exam.date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });

        return (
          <div 
            key={exam.id} 
            className={`bg-card border border-border p-4 ${
              isPast ? 'opacity-50' : isUrgent ? 'border-destructive' : ''
            }`}
          >
            <div className="text-center">
              <h3 className="font-bold text-foreground text-lg mb-1">
                {exam.subjectAr}
              </h3>
              <p className="text-muted-foreground text-sm mb-3">
                {exam.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })} @ {examTime}
              </p>
              
              {isPast ? (
                <p className="text-muted-foreground">انتهى الامتحان</p>
              ) : (
                <div className="flex justify-center gap-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                      {timeLeft.days}
                    </div>
                    <div className="text-xs text-muted-foreground">يوم</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                      {timeLeft.hours}
                    </div>
                    <div className="text-xs text-muted-foreground">ساعة</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                      {timeLeft.minutes}
                    </div>
                    <div className="text-xs text-muted-foreground">دقيقة</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                      {timeLeft.seconds}
                    </div>
                    <div className="text-xs text-muted-foreground">ثانية</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
