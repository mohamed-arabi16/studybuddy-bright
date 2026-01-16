import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  topicsCount: number;
  onSuccess: () => void;
}

export default function AddTopicDialog({
  open,
  onOpenChange,
  courseId,
  topicsCount,
  onSuccess,
}: AddTopicDialogProps) {
  const { t, dir } = useLanguage();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [difficultyWeight, setDifficultyWeight] = useState(3);
  const [examImportance, setExamImportance] = useState(3);
  const [analyzeWithAI, setAnalyzeWithAI] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // P2 Fix: Track if already analyzed to prevent duplicate calls
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setDifficultyWeight(3);
    setExamImportance(3);
    setAnalyzeWithAI(true);
    setHasAnalyzed(false);
  };

  const handleAnalyze = async () => {
    if (!title.trim()) {
      toast.error(t('enterTopicTitleFirst'));
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // P1 Fix: Pass courseId for better scoring context
      const response = await supabase.functions.invoke("analyze-topic", {
        body: { title, notes, courseId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        // Handle rate limit error specifically
        if (response.error.message?.includes("RATE_LIMIT_EXCEEDED") || response.error.status === 429) {
          toast.error(t('rateLimitExceeded') || "Rate limit exceeded. Please wait a few minutes.");
          return;
        }
        throw new Error(response.error.message);
      }

      const { difficulty_weight, exam_importance, needs_review } = response.data;
      setDifficultyWeight(difficulty_weight);
      setExamImportance(exam_importance);
      setHasAnalyzed(true);
      
      if (needs_review) {
        toast.info(t('topicAnalyzedWithDefaults') || "Topic analyzed with estimated values");
      } else {
        toast.success(t('topicAnalyzedWithAI'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('unknownError');
      toast.error(t('topicAnalysisFailed') + message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t('enterTopicTitle'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If AI analysis is enabled and not yet analyzed, do it now
      // P2 Fix: Skip if already analyzed to avoid duplicate calls
      let finalDifficulty = difficultyWeight;
      let finalImportance = examImportance;

      if (analyzeWithAI && !hasAnalyzed) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // P1 Fix: Pass courseId for better scoring context
            const response = await supabase.functions.invoke("analyze-topic", {
              body: { title, notes, courseId },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!response.error && response.data) {
              finalDifficulty = response.data.difficulty_weight;
              finalImportance = response.data.exam_importance;
            }
          }
        } catch {
          // Fallback to manual values if AI fails
        }
      }

      const { error } = await supabase.from("topics").insert({
        course_id: courseId,
        user_id: user.id,
        title: title.trim(),
        notes: notes.trim() || null,
        difficulty_weight: finalDifficulty,
        exam_importance: finalImportance,
        status: "not_started",
        confidence_level: analyzeWithAI ? "high" : "medium",
        order_index: topicsCount,
      });

      if (error) throw error;

      toast.success(t('topicAddedSuccess'));
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('unknownError');
      toast.error(t('topicAddFailed') + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t('addNewTopic')}</DialogTitle>
          <DialogDescription>
            {t('addNewTopicDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('topicTitleLabel')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('topicTitlePlaceholder')}
              dir="auto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('notesOptional')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              dir="auto"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <Label>{t('difficultyLabel')} {difficultyWeight}</Label>
              <span className="text-xs text-muted-foreground">{t('difficultyHelp')}</span>
            </div>
            <div dir="ltr">
              <Slider
                value={[difficultyWeight]}
                onValueChange={(v) => setDifficultyWeight(v[0])}
                min={1}
                max={5}
                step={1}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <Label>{t('importanceLabel')} {examImportance}</Label>
              <span className="text-xs text-muted-foreground">{t('importanceHelp')}</span>
            </div>
            <div dir="ltr">
              <Slider
                value={[examImportance]}
                onValueChange={(v) => setExamImportance(v[0])}
                min={1}
                max={5}
                step={1}
              />
            </div>
          </div>

          <div className={`flex items-center ${dir === 'rtl' ? 'space-x-reverse' : ''} space-x-2 border rounded-lg p-3 bg-muted/50`}>
            <Checkbox
              id="analyzeWithAI"
              checked={analyzeWithAI}
              onCheckedChange={(checked) => setAnalyzeWithAI(checked === true)}
            />
            <Label htmlFor="analyzeWithAI" className="text-sm cursor-pointer flex-1 px-2">
              {t('analyzeWithAILabel')}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !title.trim()}
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="text-center p-2 rounded bg-muted">
            <span className="text-sm text-muted-foreground">{t('calculatedScore')}</span>
            <span className="font-bold">{difficultyWeight * examImportance}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                {t('adding')}
              </>
            ) : (
              t('addTopicButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
