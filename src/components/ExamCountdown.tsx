import { exams } from '@/data/studySchedule';
import { useCountdown } from '@/hooks/useCountdown';

// Individual exam countdown component using shared hook
function ExamCard({ exam }: { exam: typeof exams[0] }) {
  const timeLeft = useCountdown(exam.date);
  const isUrgent = timeLeft.days < 2 && timeLeft.total > 0;
  const isPast = timeLeft.total <= 0;

  const examTime = exam.date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div 
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
}

export function ExamCountdown() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {exams.map(exam => (
        <ExamCard key={exam.id} exam={exam} />
      ))}
    </div>
  );
}
