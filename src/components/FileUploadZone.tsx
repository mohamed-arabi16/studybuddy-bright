import { useState, useCallback } from 'react';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { probePdf, extractFullText, renderPagesToImages, type ExtractionMode } from '@/lib/pdfExtractor';

interface FileUploadZoneProps {
  courseId: string;
  onUploadComplete?: (fileId: string, filePath: string) => void;
  maxSizeMB?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'probing' | 'extracting' | 'ocr' | 'completed' | 'failed';
  path?: string;
  extractionStatus?: string;
  extractionMode?: ExtractionMode;
  ocrProgress?: { current: number; total: number };
}

const OCR_BATCH_SIZE = 3; // Pages per OCR batch

export function FileUploadZone({ courseId, onUploadComplete, maxSizeMB = 20 }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  // Update file state helper
  const updateFile = (id: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // TEXT mode: Client extracts text and sends to ingest-pdf-text
  const handleTextModeExtraction = async (
    fileId: string,
    file: File,
    totalPages: number
  ): Promise<boolean> => {
    try {
      updateFile(fileId, { status: 'extracting' });
      
      const fullText = await extractFullText(file);
      
      if (!fullText || fullText.length < 50) {
        // Not enough text - fallback to OCR
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('ingest-pdf-text', {
        body: { fileId, extractedText: fullText, totalPages },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        console.error('Ingest error:', response.error);
        return false;
      }

      return response.data?.success === true;
    } catch (error) {
      console.error('Text extraction error:', error);
      return false;
    }
  };

  // OCR mode: Render pages to images and send to ocr-pages in batches
  const handleOcrModeExtraction = async (
    fileId: string,
    file: File,
    totalPages: number
  ): Promise<boolean> => {
    try {
      updateFile(fileId, { status: 'ocr', ocrProgress: { current: 0, total: totalPages } });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get course ID from the file record
      const { data: fileRecord } = await supabase
        .from('course_files')
        .select('course_id')
        .eq('id', fileId)
        .single();
      
      const courseIdForOcr = fileRecord?.course_id || courseId;

      let allText = '';
      let processedPages = 0;

      // Process pages in batches
      for (let startPage = 1; startPage <= totalPages; startPage += OCR_BATCH_SIZE) {
        const endPage = Math.min(startPage + OCR_BATCH_SIZE - 1, totalPages);
        
        // Render this batch of pages to images
        const pageImages = await renderPagesToImages(file, startPage, endPage, 1.2, 0.7);
        
        // Send to OCR endpoint
        const response = await supabase.functions.invoke('ocr-pages', {
          body: {
            courseId: courseIdForOcr,
            fileId,
            pages: pageImages.map(p => ({
              pageNumber: p.pageNumber,
              imageBase64: p.imageBase64,
            })),
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.error) {
          console.error('OCR error:', response.error);
          // Continue with other pages
        } else if (response.data?.pages) {
          for (const page of response.data.pages) {
            allText += `\n--- Page ${page.pageNumber} ---\n${page.text}\n`;
          }
        }

        processedPages = endPage;
        updateFile(fileId, { ocrProgress: { current: processedPages, total: totalPages } });
      }

      if (!allText || allText.length < 50) {
        return false;
      }

      // Save the OCR'd text via ingest-pdf-text
      const ingestResponse = await supabase.functions.invoke('ingest-pdf-text', {
        body: { fileId, extractedText: allText, totalPages },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Update the extraction method to ocr_vision
      await supabase
        .from('course_files')
        .update({ extraction_method: 'ocr_vision' })
        .eq('id', fileId);

      return ingestResponse.data?.success === true;
    } catch (error) {
      console.error('OCR extraction error:', error);
      return false;
    }
  };

  // Main PDF extraction orchestration
  const triggerPdfExtraction = async (fileId: string, file: File, fileName: string) => {
    try {
      updateFile(fileId, { status: 'probing' });
      
      // Step 1: Probe PDF to determine extraction mode
      const probeResult = await probePdf(file);
      
      updateFile(fileId, { extractionMode: probeResult.mode });

      let success = false;

      // Step 2: Execute appropriate extraction mode
      if (probeResult.mode === 'text') {
        // TEXT mode: fast client-side extraction
        toast({
          title: t('extractingText'),
          description: `${fileName} - Text mode (fast)`,
        });
        
        success = await handleTextModeExtraction(fileId, file, probeResult.totalPages);
        
        // If text mode fails (not enough text), fallback to OCR
        if (!success && probeResult.charCount > 200) {
          // Had some text but failed - mark as extracted with what we got
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke('ingest-pdf-text', {
              body: { fileId, extractedText: probeResult.probeText, totalPages: probeResult.totalPages },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            success = true;
          }
        } else if (!success) {
          // Fallback to OCR
          toast({
            title: t('extractingText'),
            description: `${fileName} - Switching to OCR mode...`,
          });
          success = await handleOcrModeExtraction(fileId, file, probeResult.totalPages);
        }
      } else {
        // OCR mode: render pages and use AI vision
        toast({
          title: t('extractingText'),
          description: `${fileName} - OCR mode (${probeResult.totalPages} pages)`,
        });
        
        success = await handleOcrModeExtraction(fileId, file, probeResult.totalPages);
      }

      if (success) {
        updateFile(fileId, { status: 'completed', extractionStatus: 'extracted' });
        toast({
          title: t('textExtracted'),
          description: `${t('readyToExtract')} ${fileName}`,
        });
      } else {
        updateFile(fileId, { status: 'completed', extractionStatus: 'manual_required' });
        toast({
          title: t('extractionNotice'),
          description: t('addManually'),
        });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      updateFile(fileId, { status: 'completed', extractionStatus: 'failed' });
      toast({
        title: t('extractionFailed'),
        description: t('addManually'),
        variant: 'destructive',
      });
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

      // Update with real ID
      setUploadedFiles(prev => prev.map(f => 
        f.id === tempId 
          ? { ...f, id: fileRecord.id, path: filePath }
          : f
      ));

      toast({
        title: t('fileUploaded'),
        description: `${t('extractingText')} ${file.name}...`,
      });

      // Trigger client-side PDF extraction (tiered approach)
      await triggerPdfExtraction(fileRecord.id, file, file.name);

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

  const getStatusDisplay = (file: UploadedFile) => {
    switch (file.status) {
      case 'uploading':
        return { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" />, text: t('uploading') };
      case 'probing':
        return { icon: <FileSearch className="w-4 h-4 animate-pulse text-primary" />, text: 'Analyzing PDF...' };
      case 'extracting':
        return { icon: <FileSearch className="w-4 h-4 animate-pulse text-primary" />, text: 'Extracting text...' };
      case 'ocr':
        const progress = file.ocrProgress;
        const progressText = progress ? `OCR: ${progress.current}/${progress.total} pages` : 'Running OCR...';
        return { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" />, text: progressText };
      case 'completed':
        return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: null };
      case 'failed':
        return { icon: <AlertCircle className="w-4 h-4 text-destructive" />, text: null };
      default:
        return { icon: null, text: null };
    }
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
          {uploadedFiles.map(file => {
            const statusDisplay = getStatusDisplay(file);
            
            return (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="p-3 flex items-center gap-3">
                  <File className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      {file.extractionMode && (
                        <span className="text-primary">
                          {file.extractionMode === 'text' ? 'Text mode' : 'OCR mode'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusDisplay.icon}
                    {statusDisplay.text && (
                      <span className="text-xs text-muted-foreground">{statusDisplay.text}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
