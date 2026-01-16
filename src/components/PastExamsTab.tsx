import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  FileText, Upload, Sparkles, Loader2, CheckCircle, 
  AlertCircle, BarChart3, TrendingUp, Info, Flame
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useYieldMetrics, TopicYieldMetric, PastExam } from "@/hooks/useYieldMetrics";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CourseFile {
  id: string;
  file_name: string;
  extraction_status: string;
  extracted_text: string | null;
}

interface PastExamsTabProps {
  courseId: string;
  files: CourseFile[];
}

/**
 * Past Exams Tab for Course Detail page
 * Allows users to upload and analyze past exams to discover high-yield topics
 */
export function PastExamsTab({ courseId, files }: PastExamsTabProps) {
  const { t, language, dir } = useLanguage();
  const { 
    yieldMetrics, 
    pastExams, 
    summary, 
    isLoading, 
    analyzeExam,
    refresh 
  } = useYieldMetrics(courseId);
  const { getCost, canAfford, credits } = useCredits();
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [applyToPlanning, setApplyToPlanning] = useState(true);

  const analyzeExamCost = getCost('analyze_past_exam');
  const canAffordAnalysis = canAfford('analyze_past_exam');

  // Filter files that have extracted text (ready for analysis)
  const analyzableFiles = files.filter(
    f => (f.extraction_status === 'extracted' || f.extraction_status === 'completed') 
      && f.extracted_text
  );

  // Check if a file has already been analyzed
  const isFileAnalyzed = (fileId: string): boolean => {
    return pastExams.some(exam => {
      // Access file_id safely using optional chaining on extended exam type
      const examWithFileId = exam as PastExam & { file_id?: string };
      return examWithFileId.file_id === fileId && exam.analysis_status === 'completed';
    });
  };

  const handleAnalyzeExam = async (file: CourseFile) => {
    if (!canAffordAnalysis) {
      toast.error(
        language === "ar" 
          ? "رصيد غير كافٍ" 
          : "Insufficient credits",
        {
          description: language === "ar"
            ? `تحتاج ${analyzeExamCost} رصيد لتحليل الامتحان`
            : `You need ${analyzeExamCost} credits to analyze an exam`
        }
      );
      return;
    }

    try {
      setAnalyzingFileId(file.id);
      
      const result = await analyzeExam(file.id, file.file_name);
      
      if (result.success) {
        toast.success(
          language === "ar" ? "تم تحليل الامتحان" : "Exam analyzed successfully",
          {
            description: language === "ar"
              ? "تم اكتشاف المواضيع عالية العائد"
              : "High-yield topics discovered"
          }
        );
      } else {
        toast.error(
          language === "ar" ? "فشل التحليل" : "Analysis failed",
          { description: result.error }
        );
      }
    } catch (error) {
      console.error("Exam analysis error:", error);
      toast.error(language === "ar" ? "حدث خطأ" : "An error occurred");
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const getYieldBadgeVariant = (yield_: number): "default" | "secondary" | "outline" | "destructive" => {
    if (yield_ >= 0.7) return "default";
    if (yield_ >= 0.4) return "secondary";
    return "outline";
  };

  const getYieldLabel = (yield_: number): string => {
    if (yield_ >= 0.7) return language === "ar" ? "عالي جداً" : "Very High";
    if (yield_ >= 0.4) return language === "ar" ? "متوسط" : "Medium";
    return language === "ar" ? "منخفض" : "Low";
  };

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {language === "ar"
            ? "قم بتحليل امتحاناتك السابقة لاكتشاف المواضيع الأكثر أهمية وتحسين خطة المذاكرة"
            : "Analyze your past exams to discover high-yield topics and optimize your study plan"}
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      {summary && summary.exams_analyzed > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{summary.exams_analyzed}</div>
                <div className="text-xs text-muted-foreground">
                  {language === "ar" ? "امتحانات محللة" : "Exams Analyzed"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.topics_with_yield_data}</div>
                <div className="text-xs text-muted-foreground">
                  {language === "ar" ? "مواضيع بيانات" : "Topics with Data"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{summary.high_yield_topics}</div>
                <div className="text-xs text-muted-foreground">
                  {language === "ar" ? "عالي العائد" : "High Yield"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{summary.weak_high_yield_count}</div>
                <div className="text-xs text-muted-foreground">
                  {language === "ar" ? "تحتاج تركيز" : "Need Focus"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apply to Planning Toggle */}
      {yieldMetrics.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="apply-insights" className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {language === "ar" ? "تطبيق النتائج على الخطة" : "Apply Insights to Plan"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? "سيتم إعطاء الأولوية للمواضيع عالية العائد في خطتك"
                    : "High-yield topics will be prioritized in your study plan"}
                </p>
              </div>
              <Switch
                id="apply-insights"
                checked={applyToPlanning}
                onCheckedChange={setApplyToPlanning}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Analyze New Exam */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {language === "ar" ? "تحليل امتحان" : "Analyze Exam"}
            </CardTitle>
            <CardDescription>
              {language === "ar"
                ? "اختر ملف من الملفات المرفوعة لتحليله"
                : "Select a file from your uploads to analyze"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analyzableFiles.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {language === "ar"
                    ? "لا توجد ملفات جاهزة للتحليل"
                    : "No files ready for analysis"}
                </p>
                <p className="text-xs mt-1">
                  {language === "ar"
                    ? "ارفع ملفات امتحانات في تبويب الملفات أولاً"
                    : "Upload exam files in the Files tab first"}
                </p>
              </div>
            ) : (
              <>
                {analyzableFiles.map(file => {
                  const alreadyAnalyzed = isFileAnalyzed(file.id);
                  const isAnalyzing = analyzingFileId === file.id;

                  return (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.file_name}</p>
                          {alreadyAnalyzed && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <CheckCircle className="w-3 h-3 me-1" />
                              {language === "ar" ? "تم التحليل" : "Analyzed"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyAnalyzed ? "outline" : "default"}
                        onClick={() => handleAnalyzeExam(file)}
                        disabled={isAnalyzing || analyzingFileId !== null || !canAffordAnalysis}
                        className="gap-1 flex-shrink-0"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {language === "ar" ? "جاري..." : "Analyzing..."}
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-3 h-3" />
                            {alreadyAnalyzed 
                              ? (language === "ar" ? "إعادة" : "Re-analyze")
                              : (language === "ar" ? "تحليل" : "Analyze")}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center">
                  {language === "ar"
                    ? `التكلفة: ${analyzeExamCost} رصيد`
                    : `Cost: ${analyzeExamCost} credits`}
                  {!canAffordAnalysis && (
                    <span className="text-destructive block">
                      {language === "ar" ? "رصيد غير كافٍ" : "Insufficient credits"}
                    </span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* High-Yield Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              {language === "ar" ? "المواضيع عالية العائد" : "High-Yield Topics"}
            </CardTitle>
            <CardDescription>
              {language === "ar"
                ? "المواضيع الأكثر ظهوراً في الامتحانات السابقة"
                : "Topics that appear most frequently in past exams"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : yieldMetrics.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {language === "ar"
                    ? "لا توجد بيانات عائد بعد"
                    : "No yield data yet"}
                </p>
                <p className="text-xs mt-1">
                  {language === "ar"
                    ? "قم بتحليل امتحان لاكتشاف المواضيع المهمة"
                    : "Analyze an exam to discover important topics"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {yieldMetrics.slice(0, 8).map((metric, index) => (
                  <div 
                    key={metric.topic_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index < 3 ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(metric as any).topic_title || `Topic ${index + 1}`}
                      </p>
                      <Progress 
                        value={metric.normalized_yield_score}
                        className="h-1.5 mt-1"
                      />
                    </div>
                    <Badge variant={getYieldBadgeVariant(metric.normalized_yield_score / 100)}>
                      {Math.round(metric.normalized_yield_score)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Past Exams List */}
      {pastExams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === "ar" ? "الامتحانات المحللة" : "Analyzed Exams"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastExams.map(exam => (
                <div 
                  key={exam.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{exam.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(exam.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    exam.analysis_status === 'completed' ? 'secondary' :
                    exam.analysis_status === 'analyzing' ? 'outline' :
                    exam.analysis_status === 'failed' ? 'destructive' : 'outline'
                  }>
                    {exam.analysis_status === 'completed' && <CheckCircle className="w-3 h-3 me-1" />}
                    {exam.analysis_status === 'analyzing' && <Loader2 className="w-3 h-3 me-1 animate-spin" />}
                    {exam.analysis_status === 'failed' && <AlertCircle className="w-3 h-3 me-1" />}
                    {exam.analysis_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
