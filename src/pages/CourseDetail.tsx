import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, Calendar, Upload, FileText, List, 
  Sparkles, RefreshCw, AlertCircle, CheckCircle, Info,
  Pencil, Trash2, MoreVertical
} from "lucide-react";
import { format } from "date-fns";
import TopicManager from "@/components/TopicManager";
import AllocationView from "@/components/AllocationView";
import { FileUploadZone } from "@/components/FileUploadZone";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { DeleteCourseDialog } from "@/components/DeleteCourseDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Course = {
  id: string;
  title: string;
  exam_date: string | null;
  status: string;
};

type CourseFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  extraction_status: string;
  extracted_text: string | null;
  extraction_quality: string | null;
  extraction_metadata: unknown;
  created_at: string;
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [course, setCourse] = useState<Course | null>(null);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [topicCount, setTopicCount] = useState(0);
  const [fileToDelete, setFileToDelete] = useState<CourseFile | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const fetchCourse = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setCourse(data);

      // Fetch files with metadata
      const { data: filesData } = await supabase
        .from("course_files")
        .select("id, file_name, file_path, file_size, extraction_status, extracted_text, extraction_quality, extraction_metadata, created_at")
        .eq("course_id", id)
        .order("created_at", { ascending: false });

      setFiles(filesData || []);
      
      // Fetch topic count for delete warning
      const { count } = await supabase
        .from("topics")
        .select("id", { count: 'exact', head: true })
        .eq("course_id", id);
      
      setTopicCount(count || 0);
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error(t('planError'));
      navigate("/app/courses");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    // Small delay to allow DB to update
    setTimeout(() => fetchCourse(), 500);
  };

  const retryExtraction = async (fileId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Update status to show loading
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, extraction_status: 'extracting' } : f
      ));

      const response = await supabase.functions.invoke('parse-pdf', {
        body: { fileId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      await fetchCourse();
      
      if (response.data.success) {
        toast.success(t('textExtracted'));
      } else {
        toast.info(response.data.message || t('extractionNotice'));
      }
    } catch (error) {
      console.error("Retry extraction error:", error);
      toast.error(t('extractionFailed'));
      await fetchCourse();
    }
  };

  const extractTopicsFromFile = async (file: CourseFile) => {
    if (!file.extracted_text) {
      toast.error(t('extractionFailed'));
      return;
    }

    // Prevent double-clicks or clicking another file while extracting
    if (extractingFileId) {
      toast.warning('Please wait for current extraction to complete');
      return;
    }

    try {
      setExtractingFileId(file.id);  // Track WHICH file is extracting
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('extract-topics', {
        body: { 
          courseId: course?.id,
          text: file.extracted_text,
          fileId: file.id,
          mode: 'append',  // Add to existing topics instead of replacing
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);

      toast.success(`${t('topicsExtracted')} (${response.data.topics_count})`);
      
      if (response.data.needs_review) {
        toast.info(t('someNeedReview'));
      }
      
    } catch (error) {
      console.error("Extract error:", error);
      toast.error(error instanceof Error ? error.message : t('extractFailed'));
    } finally {
      setExtractingFileId(null);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      setDeletingFile(true);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('course-files')
        .remove([fileToDelete.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue anyway to delete DB record
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('course_files')
        .delete()
        .eq('id', fileToDelete.id);

      if (dbError) throw dbError;

      toast.success(t('fileDeleted'));
      setFileToDelete(null);
      fetchCourse();
    } catch (error) {
      console.error("Delete file error:", error);
      toast.error(t('deleteFileFailed'));
    } finally {
      setDeletingFile(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!course) return null;

  const daysUntilExam = course.exam_date 
    ? Math.ceil((new Date(course.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center space-x-4 rtl:space-x-reverse">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/courses")}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          {course.exam_date && (
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center text-muted-foreground">
                <Calendar className="me-2 h-4 w-4" />
                <span>{t('exam')}: {format(new Date(course.exam_date), "PPP")}</span>
              </div>
              {daysUntilExam !== null && (
                <Badge variant={daysUntilExam <= 7 ? "destructive" : "secondary"}>
                  {daysUntilExam > 0 ? `${daysUntilExam} ${t('daysLeft')}` : t('examPassed')}
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Edit/Delete Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Pencil className="me-2 h-4 w-4" />
              {t('editCourse') || 'Edit Course'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="me-2 h-4 w-4" />
              {t('deleteCourse') || 'Delete Course'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files" className="gap-2">
            <Upload className="w-4 h-4" />
            {t('files')}
          </TabsTrigger>
          <TabsTrigger value="topics" className="gap-2">
            <List className="w-4 h-4" />
            {t('topics')}
          </TabsTrigger>
          <TabsTrigger value="allocation" className="gap-2">
            <Calendar className="w-4 h-4" />
            {t('allocation')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('filesTip')}</AlertDescription>
          </Alert>

          {/* Warning when files are still processing */}
          {files.some(f => ['pending', 'extracting', 'probing', 'ocr_in_progress'].includes(f.extraction_status)) && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                {t('waitForUploadsToFinish')}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('uploadCourseMaterials')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadZone 
                courseId={course.id} 
                onUploadComplete={handleFileUpload}
              />
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('uploadedFiles')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.map(file => {
                    const isExtracting = file.extraction_status === 'extracting';
                    // FIX: Include 'completed' status (from OCR mode) along with 'extracted'
                    const isExtracted = file.extraction_status === 'extracted' || file.extraction_status === 'completed';
                    const isFailed = file.extraction_status === 'failed';
                    const isPending = file.extraction_status === 'pending';
                    const needsManual = file.extraction_status === 'manual_required';
                    const isEmpty = file.extraction_status === 'empty';
                    const isFileTooLarge = file.extraction_status === 'file_too_large';
                    const canRetry = isFailed || isPending || needsManual || isEmpty;
                    
                    // Get status display info
                    const getStatusInfo = () => {
                      if (isExtracting) return { label: t('extractingText'), variant: 'outline' as const, icon: <Loader2 className="w-3 h-3 animate-spin" /> };
                      if (isExtracted) return { label: t('ready'), variant: 'default' as const, icon: <CheckCircle className="w-3 h-3" /> };
                      if (isFailed) return { label: t('failed'), variant: 'destructive' as const, icon: <AlertCircle className="w-3 h-3" /> };
                      if (needsManual) return { label: t('manualInputNeeded'), variant: 'outline' as const, icon: <AlertCircle className="w-3 h-3" /> };
                      if (isEmpty) return { label: 'No text found', variant: 'outline' as const, icon: <AlertCircle className="w-3 h-3" /> };
                      if (isFileTooLarge) return { label: 'File too large', variant: 'destructive' as const, icon: <AlertCircle className="w-3 h-3" /> };
                      if (isPending) return { label: t('pending'), variant: 'outline' as const, icon: null };
                      return { label: file.extraction_status, variant: 'outline' as const, icon: null };
                    };
                    
                    const statusInfo = getStatusInfo();
                    
                    return (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{(file.file_size / 1024 / 1024).toFixed(1)} MB</span>
                              <Badge variant={statusInfo.variant} className="text-xs gap-1">
                                {statusInfo.icon}
                                {statusInfo.label}
                              </Badge>
                              {isExtracted && file.extraction_quality && (
                                <Badge variant="outline" className="text-xs">
                                  {file.extraction_quality} quality
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Retry button for retryable statuses */}
                          {canRetry && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryExtraction(file.id)}
                              className="gap-1"
                            >
                              <RefreshCw className="w-4 h-4" />
                              {t('retry')}
                            </Button>
                          )}
                          {/* Extract Topics button - show when extracted */}
                          {isExtracted && file.extracted_text && (
                            <Button
                              size="sm"
                              onClick={() => extractTopicsFromFile(file)}
                              disabled={
                                extractingFileId !== null ||  // Any file is extracting
                                files.some(f => ['pending', 'extracting', 'probing', 'ocr_in_progress'].includes(f.extraction_status))
                              }
                              className="gap-2"
                            >
                              {extractingFileId === file.id ? (  // Only show spinner on THIS file
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {t('extractTopics')}
                            </Button>
                          )}
                          {/* Delete button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFileToDelete(file)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('topicsTip')}</AlertDescription>
          </Alert>
          <TopicManager courseId={course.id} />
        </TabsContent>

        <TabsContent value="allocation">
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>{t('allocationTip')}</AlertDescription>
          </Alert>
          <AllocationView course={course} />
        </TabsContent>
      </Tabs>
      
      {/* Edit Course Dialog */}
      <EditCourseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        course={course}
        onCourseUpdated={fetchCourse}
      />
      
      {/* Delete Course Dialog */}
      <DeleteCourseDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        course={course}
        topicCount={topicCount}
      />

      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteFile')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteFileWarning')} "{fileToDelete?.file_name}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={deletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFile && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
