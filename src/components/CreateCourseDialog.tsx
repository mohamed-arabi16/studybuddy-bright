import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeCard } from "@/components/UpgradeCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface CreateCourseDialogProps {
  onCourseCreated?: () => void;
  autoOpen?: boolean;
  onAutoOpenComplete?: () => void;
}

export function CreateCourseDialog({ onCourseCreated, autoOpen, onAutoOpenComplete }: CreateCourseDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { checkLimit, usage, limits, isLoading: subLoading } = useSubscription();
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const navigate = useNavigate();

  // Handle auto-open when coming from grade calculator
  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      onAutoOpenComplete?.();
    }
  }, [autoOpen, onAutoOpenComplete]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          title,
          exam_date: examDate || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('courseCreatedSuccess'));
      setOpen(false);
      setTitle("");
      setExamDate("");
      if (onCourseCreated) onCourseCreated();
      
      // Check if we should return to grade calculator
      const returnToGradeCalc = sessionStorage.getItem('returnToGradeCalc');
      if (returnToGradeCalc && data) {
        sessionStorage.removeItem('returnToGradeCalc');
        navigate(`/app/grade-calculator?courseId=${data.id}`);
      } else if (data) {
        navigate(`/app/courses/${data.id}`);
      }

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = checkLimit('courses', usage.courses);
  const isUnlimited = limits.courses === -1;
  const remaining = isUnlimited ? -1 : limits.courses - usage.courses;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={subLoading}>
          <Plus className="ms-2 h-4 w-4" />
          {t('addCourse')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {canCreate ? (
          <>
            <DialogHeader className="text-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>{t('addNewCourse')}</DialogTitle>
                  <DialogDescription>
                    {t('addNewCourseDesc')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">{t('courseNameLabel')}</Label>
                  <Input
                    id="title"
                    placeholder={t('courseNamePlaceholder')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    dir="auto"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="examDate">{t('examDateOptional')}</Label>
                  <Input
                    id="examDate"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('examDateHelp')}
                  </p>
                </div>
              </div>
              
              {/* Remaining count indicator */}
              {!isUnlimited && remaining <= 2 && remaining > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  {t('remainingLimit')} <span className="font-semibold text-foreground">{remaining}</span> {remaining === 1 ? t('course') : t('courses_plural')} {t('inCurrentPlan')}
                </div>
              )}
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t('creating') : t('createCourseButton')}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <UpgradeCard 
            variant="modal" 
            trigger="course_limit"
            onUpgrade={() => {
              setOpen(false);
              navigate('/app/settings');
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
