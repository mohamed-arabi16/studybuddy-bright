import { useState, useCallback } from 'react';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileUploadZoneProps {
  courseId: string;
  onUploadComplete?: (fileId: string, filePath: string) => void;
  maxSizeMB?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'extracting' | 'completed' | 'failed';
  path?: string;
  extractionStatus?: string;
}

export function FileUploadZone({ courseId, onUploadComplete, maxSizeMB = 20 }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  const triggerPdfExtraction = async (fileId: string, fileName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('parse-pdf', {
        body: { fileId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Extraction error:', response.error);
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, status: 'completed', extractionStatus: 'failed' } : f
        ));
        toast({
          title: t('extractionFailed'),
          description: t('addManually'),
          variant: 'destructive',
        });
        return;
      }

      const result = response.data;
      
      if (result.success) {
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, status: 'completed', extractionStatus: 'extracted' } : f
        ));
        toast({
          title: t('textExtracted'),
          description: `${t('readyToExtract')} ${fileName}`,
        });
      } else {
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, status: 'completed', extractionStatus: result.status || 'manual_required' } : f
        ));
        toast({
          title: t('extractionNotice'),
          description: result.message || t('addManually'),
        });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'completed', extractionStatus: 'failed' } : f
      ));
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: t('failed'),
        description: 'Only PDF files are allowed',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: t('failed'),
        description: `${t('maxFileSize')}: ${maxSizeMB}MB`,
        variant: 'destructive',
      });
      return;
    }

    const tempId = crypto.randomUUID();
    setUploadedFiles(prev => [...prev, {
      id: tempId,
      name: file.name,
      size: file.size,
      status: 'uploading',
    }]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${courseId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create database record
      const { data: fileRecord, error: dbError } = await supabase
        .from('course_files')
        .insert({
          course_id: courseId,
          user_id: user.id,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          extraction_status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update status to extracting
      setUploadedFiles(prev => prev.map(f => 
        f.id === tempId 
          ? { ...f, id: fileRecord.id, status: 'extracting', path: filePath }
          : f
      ));

      toast({
        title: t('fileUploaded'),
        description: `${t('extractingText')} ${file.name}...`,
      });

      // Trigger PDF text extraction
      await triggerPdfExtraction(fileRecord.id, file.name);

      onUploadComplete?.(fileRecord.id, filePath);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFiles(prev => prev.map(f => 
        f.id === tempId ? { ...f, status: 'failed' } : f
      ));
      toast({
        title: t('failed'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [courseId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
  };

  const removeFile = async (fileId: string, filePath?: string) => {
    try {
      if (filePath) {
        await supabase.storage.from('course-files').remove([filePath]);
        await supabase.from('course_files').delete().eq('id', fileId);
      }
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4" dir={dir}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
          }
        `}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
        />
        <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium">
          {t('dropFilesHere')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('maxFileSize')}: {maxSizeMB}MB
        </p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map(file => (
            <Card key={file.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <File className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'uploading' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>{t('uploading')}</span>
                    </div>
                  )}
                  {file.status === 'extracting' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileSearch className="w-4 h-4 animate-pulse text-primary" />
                      <span>{t('extractingText')}</span>
                    </div>
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {file.status === 'failed' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFile(file.id, file.path)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}