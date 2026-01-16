import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, CheckCircle, XCircle, Loader2, Sparkles, 
  ChevronRight, Trophy, TrendingUp 
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short_answer';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

interface QuizAnswer {
  question_id: string;
  user_answer: string;
  is_correct?: boolean;
}

interface QuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicTitle: string;
  courseId: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  onQuizComplete?: (score: number, masteryUpdate: any) => void;
}

type QuizState = 'loading' | 'ready' | 'in_progress' | 'review' | 'complete' | 'error';

/**
 * QuizModal component for taking micro-quizzes to assess topic mastery
 * Integrates with the generate-quiz and submit-quiz-attempt edge functions
 */
export function QuizModal({
  open,
  onOpenChange,
  topicId,
  topicTitle,
  courseId,
  difficulty = 'medium',
  onQuizComplete,
}: QuizModalProps) {
  const { t, language, dir } = useLanguage();
  const { getCost, canAfford, refresh: refreshCredits } = useCredits();
  
  const [state, setState] = useState<QuizState>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [quizBankId, setQuizBankId] = useState<string | null>(null);
  const [masteryResult, setMasteryResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);

  const quizCost = getCost('generate_quiz');
  const canAffordQuiz = canAfford('generate_quiz');

  // Load quiz when modal opens
  const loadQuiz = useCallback(async () => {
    if (!open) return;
    
    setState('loading');
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('generate-quiz', {
        body: {
          course_id: courseId,
          topic_id: topicId,
          difficulty,
          count: 5,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        // Check for insufficient credits error
        if (response.error.message.includes('INSUFFICIENT_CREDITS') || response.error.context?.status === 402) {
          throw new Error(language === 'ar' ? 'رصيد غير كافٍ' : 'Insufficient credits');
        }
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      if (!data?.success || !data?.quiz?.questions) {
        throw new Error(data?.error || 'Failed to load quiz');
      }

      setQuestions(data.quiz.questions);
      setQuizBankId(data.quiz.id);
      setCacheHit(data.cache_hit || false);
      setAnswers([]);
      setCurrentIndex(0);
      setSelectedAnswer('');
      setShowExplanation(false);
      setScore(0);
      setState('ready');
      
      // Refresh credits if this wasn't a cache hit
      if (!data.cache_hit) {
        refreshCredits();
      }
      
    } catch (err) {
      console.error('[QuizModal] Error loading quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
      setState('error');
    }
  }, [open, courseId, topicId, difficulty, language, refreshCredits]);

  useEffect(() => {
    if (open) {
      loadQuiz();
    } else {
      // Reset state when closed
      setState('loading');
      setQuestions([]);
      setAnswers([]);
      setCurrentIndex(0);
    }
  }, [open, loadQuiz]);

  const startQuiz = () => {
    setState('in_progress');
    setStartTime(Date.now());
  };

  const handleAnswer = () => {
    if (!selectedAnswer) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = currentQuestion.type === 'mcq'
      ? selectedAnswer === currentQuestion.correct_answer
      : selectedAnswer.toLowerCase().includes(currentQuestion.correct_answer.toLowerCase().substring(0, 20));

    const newAnswer: QuizAnswer = {
      question_id: currentQuestion.id,
      user_answer: selectedAnswer,
      is_correct: isCorrect,
    };

    setAnswers([...answers, newAnswer]);
    setShowExplanation(true);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowExplanation(false);
    } else {
      // Quiz complete - submit results
      submitQuizResults();
    }
  };

  const submitQuizResults = async () => {
    setState('complete');
    
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const finalScore = Math.round((score / questions.length) * 100);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('submit-quiz-attempt', {
        body: {
          topic_id: topicId,
          quiz_bank_id: quizBankId,
          answers,
          time_spent_sec: timeSpent,
          score: finalScore,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.data?.success) {
        setMasteryResult(response.data.mastery_update);
        onQuizComplete?.(finalScore, response.data.mastery_update);
      }
    } catch (err) {
      console.error('[QuizModal] Error submitting quiz:', err);
      // Don't show error - quiz is already complete
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const finalScore = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {state === 'complete' 
              ? (language === 'ar' ? 'نتيجة الاختبار' : 'Quiz Results')
              : topicTitle}
          </DialogTitle>
          <DialogDescription>
            {state === 'loading' && (language === 'ar' ? 'جاري تحميل الاختبار...' : 'Loading quiz...')}
            {state === 'ready' && (language === 'ar' ? 'اختبار سريع لتقييم مستواك' : 'Quick quiz to assess your mastery')}
            {state === 'in_progress' && (
              <span>
                {language === 'ar' ? 'السؤال' : 'Question'} {currentIndex + 1} / {questions.length}
              </span>
            )}
            {state === 'complete' && (language === 'ar' ? 'أحسنت!' : 'Well done!')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Loading State */}
          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'جاري إنشاء الأسئلة...' : 'Generating questions...'}
              </p>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </Button>
                <Button onClick={loadQuiz}>
                  {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                </Button>
              </div>
            </div>
          )}

          {/* Ready State */}
          {state === 'ready' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium">
                  {language === 'ar' 
                    ? `${questions.length} أسئلة جاهزة` 
                    : `${questions.length} questions ready`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ar' ? `مستوى: ${difficulty}` : `Difficulty: ${difficulty}`}
                </p>
                {cacheHit && (
                  <Badge variant="secondary" className="mt-2">
                    {language === 'ar' ? 'من الذاكرة المؤقتة' : 'Cached'}
                  </Badge>
                )}
              </div>
              <Button className="w-full" onClick={startQuiz}>
                {language === 'ar' ? 'ابدأ الاختبار' : 'Start Quiz'}
                <ChevronRight className="w-4 h-4 ms-1" />
              </Button>
            </div>
          )}

          {/* In Progress State */}
          {state === 'in_progress' && currentQuestion && (
            <div className="space-y-4">
              <Progress value={progress} className="h-2" />
              
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">{currentQuestion.question}</p>
              </div>

              {currentQuestion.type === 'mcq' && currentQuestion.options && (
                <RadioGroup
                  value={selectedAnswer}
                  onValueChange={setSelectedAnswer}
                  disabled={showExplanation}
                  className="space-y-2"
                >
                  {currentQuestion.options.map((option, idx) => {
                    const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
                    const isSelected = selectedAnswer === optionLetter;
                    const isCorrect = showExplanation && optionLetter === currentQuestion.correct_answer;
                    const isWrong = showExplanation && isSelected && !isCorrect;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center space-x-2 rtl:space-x-reverse p-3 rounded-lg border transition-colors",
                          isSelected && !showExplanation && "border-primary bg-primary/5",
                          isCorrect && "border-green-500 bg-green-500/10",
                          isWrong && "border-red-500 bg-red-500/10",
                          !showExplanation && "hover:bg-muted/50 cursor-pointer"
                        )}
                      >
                        <RadioGroupItem value={optionLetter} id={`option-${idx}`} />
                        <Label 
                          htmlFor={`option-${idx}`} 
                          className="flex-1 cursor-pointer"
                        >
                          <span className="font-medium me-2">{optionLetter}.</span>
                          {option}
                        </Label>
                        {isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {isWrong && <XCircle className="w-5 h-5 text-red-500" />}
                      </div>
                    );
                  })}
                </RadioGroup>
              )}

              {currentQuestion.type === 'short_answer' && (
                <Textarea
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}
                  disabled={showExplanation}
                  rows={3}
                />
              )}

              {/* Explanation */}
              {showExplanation && (
                <Alert className="border-primary/30 bg-primary/5">
                  <AlertDescription>
                    <p className="font-medium mb-1">
                      {language === 'ar' ? 'الشرح:' : 'Explanation:'}
                    </p>
                    {currentQuestion.explanation}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!showExplanation ? (
                  <Button 
                    className="flex-1" 
                    onClick={handleAnswer}
                    disabled={!selectedAnswer}
                  >
                    {language === 'ar' ? 'تحقق' : 'Check Answer'}
                  </Button>
                ) : (
                  <Button 
                    className="flex-1" 
                    onClick={nextQuestion}
                  >
                    {currentIndex < questions.length - 1 
                      ? (language === 'ar' ? 'التالي' : 'Next')
                      : (language === 'ar' ? 'إنهاء' : 'Finish')}
                    <ChevronRight className="w-4 h-4 ms-1" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Complete State */}
          {state === 'complete' && (
            <div className="space-y-4 text-center py-4">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                finalScore >= 70 ? "bg-green-500/10" : finalScore >= 50 ? "bg-yellow-500/10" : "bg-red-500/10"
              )}>
                <Trophy className={cn(
                  "w-10 h-10",
                  finalScore >= 70 ? "text-green-500" : finalScore >= 50 ? "text-yellow-500" : "text-red-500"
                )} />
              </div>
              
              <div>
                <p className="text-4xl font-bold">{finalScore}%</p>
                <p className="text-muted-foreground">
                  {score} / {questions.length} {language === 'ar' ? 'صحيح' : 'correct'}
                </p>
              </div>

              {masteryResult && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>
                    {language === 'ar' ? 'مستوى الإتقان:' : 'Mastery:'} {masteryResult.old_score}% → {masteryResult.new_score}%
                  </span>
                </div>
              )}

              <Button onClick={() => onOpenChange(false)} className="w-full">
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
