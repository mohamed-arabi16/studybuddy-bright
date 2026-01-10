import { useState } from 'react';
import { Calendar, RefreshCw, Clock, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface MissedDay {
  date: string;
  missedItems: number;
  totalItems: number;
}

interface RescheduleCardProps {
  missedDays: MissedDay[];
  totalMissedItems: number;
  onReplan: () => Promise<void>;
  isReplanning: boolean;
}

export function RescheduleCard({ 
  missedDays, 
  totalMissedItems, 
  onReplan, 
  isReplanning 
}: RescheduleCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (missedDays.length === 0) return null;

  const missedPercentage = missedDays.reduce((sum, d) => {
    return sum + ((d.missedItems / d.totalItems) * 100);
  }, 0) / missedDays.length;

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">أعد تنظيم أسبوعك</CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                لا بأس - الجميع يحتاج استراحة أحياناً
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
            {totalMissedItems} موضوع متأخر
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">نسبة الإنجاز هذا الأسبوع</span>
            <span className="font-medium">{Math.round(100 - missedPercentage)}%</span>
          </div>
          <Progress value={100 - missedPercentage} className="h-2" />
        </div>

        {/* Missed days summary */}
        {showDetails && (
          <div className="space-y-2 p-3 rounded-lg bg-background/60 border">
            <p className="text-sm font-medium text-muted-foreground">الأيام التي تحتاج مراجعة:</p>
            {missedDays.map((day) => (
              <div key={day.date} className="flex items-center justify-between text-sm">
                <span>{new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <Badge variant="secondary" className="text-xs">
                  {day.missedItems} من {day.totalItems}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Encouragement message */}
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
            <div className="text-sm text-green-700 dark:text-green-400">
              <p className="font-medium">لا تقلق!</p>
              <p className="text-green-600 dark:text-green-500">
                سنقوم بتوزيع المواضيع المتبقية بذكاء على الأيام القادمة حسب أولوية الامتحانات.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={onReplan} 
            disabled={isReplanning}
            className="flex-1 gap-2"
          >
            {isReplanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري إعادة التخطيط...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                أعد تخطيط أسبوعي
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowDetails(!showDetails)}
            className="gap-1"
          >
            {showDetails ? 'إخفاء' : 'التفاصيل'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CatchUpSuggestionProps {
  suggestion: {
    type: 'extend_today' | 'weekend_boost' | 'reduce_scope';
    message: string;
    actionLabel: string;
    impact: string;
  };
  onAccept: () => void;
  onDismiss: () => void;
}

export function CatchUpSuggestion({ suggestion, onAccept, onDismiss }: CatchUpSuggestionProps) {
  const icons = {
    extend_today: Clock,
    weekend_boost: Calendar,
    reduce_scope: CheckCircle2,
  };
  
  const Icon = icons[suggestion.type];

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Icon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">{suggestion.message}</p>
            <p className="text-xs text-muted-foreground">{suggestion.impact}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onAccept} className="h-7">
                {suggestion.actionLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7">
                ليس الآن
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
