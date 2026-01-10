import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
  };
  topicCount?: number;
}

export function DeleteCourseDialog({ 
  open, 
  onOpenChange, 
  course, 
  topicCount = 0 
}: DeleteCourseDialogProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete related data in order (respecting foreign keys)
      // 1. Delete study plan items related to this course
      await supabase
        .from('study_plan_items')
        .delete()
        .eq('course_id', course.id);

      // 2. Delete topics
      await supabase
        .from('topics')
        .delete()
        .eq('course_id', course.id);

      // 3. Delete allocations
      await supabase
        .from('allocations')
        .delete()
        .eq('course_id', course.id);

      // 4. Delete course files
      await supabase
        .from('course_files')
        .delete()
        .eq('course_id', course.id);

      // 5. Delete AI jobs related to this course
      await supabase
        .from('ai_jobs')
        .delete()
        .eq('course_id', course.id);

      // 6. Finally delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id);

      if (error) throw error;

      toast.success(t('courseDeleted') || 'Course deleted successfully');
      onOpenChange(false);
      navigate('/app/courses');
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error(t('deleteFailed') || 'Failed to delete course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('deleteCourse') || 'Delete Course'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              {t('deleteCourseConfirm') || 'Are you sure you want to delete'}{' '}
              <strong>"{course.title}"</strong>?
            </p>
            {topicCount > 0 && (
              <p className="text-destructive">
                {t('deleteWarningTopics') || 
                  `This will also delete ${topicCount} topic(s) and all related data.`}
              </p>
            )}
            <p className="font-medium">
              {t('actionCannotBeUndone') || 'This action cannot be undone.'}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {t('cancel') || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('delete') || 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
