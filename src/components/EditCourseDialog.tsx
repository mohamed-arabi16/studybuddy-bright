import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
    exam_date: string | null;
    color?: string | null;
  };
  onCourseUpdated: () => void;
}

export function EditCourseDialog({ 
  open, 
  onOpenChange, 
  course, 
  onCourseUpdated 
}: EditCourseDialogProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(course.title);
  const [examDate, setExamDate] = useState<Date | undefined>(
    course.exam_date ? new Date(course.exam_date) : undefined
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(course.title);
    setExamDate(course.exam_date ? new Date(course.exam_date) : undefined);
  }, [course]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(t('courseNameRequired') || 'Course name is required');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title: title.trim(),
          exam_date: examDate ? examDate.toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', course.id);

      if (error) throw error;

      toast.success(t('courseUpdated') || 'Course updated successfully');
      onCourseUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error(t('updateFailed') || 'Failed to update course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editCourse') || 'Edit Course'}</DialogTitle>
          <DialogDescription>
            {t('editCourseDesc') || 'Update course details and exam date'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t('courseNameLabel') || 'Course Name'}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('courseNamePlaceholder') || 'e.g. Advanced Mathematics'}
            />
          </div>
          
          <div className="grid gap-2">
            <Label>{t('examDate') || 'Exam Date'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !examDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {examDate ? format(examDate, "PPP") : (t('selectDate') || 'Select date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={examDate}
                  onSelect={setExamDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges') || 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
