import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Wand2, Plus, Save, Trash2, CheckCircle, Circle, Clock, FileText, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/hooks/useSubscription";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import AddTopicDialog from "./AddTopicDialog";

interface Topic {
  id: string;
  title: string;
  difficulty_weight: number;
  exam_importance: number;
  notes?: string;
  status: string;
  is_completed?: boolean;
  confidence_level?: string;
  source_page?: number;
  source_context?: string;
}

export default function TopicManager({ courseId }: { courseId: string }) {
  const [inputText, setInputText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { checkLimit, usage } = useSubscription();
  const { t, dir } = useLanguage();

  // Editing state
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Topic>>({});

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error("Error fetching topics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [courseId]);

  const canAddTopic = checkLimit('topics_total', usage.topics);

  const handleExtract = async () => {
    if (!inputText.trim()) {
      toast.error(t('enterTextToExtract'));
      return;
    }

    setIsExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('loginToExtract'));
        return;
      }

      const response = await supabase.functions.invoke('extract-topics', {
        body: { 
          courseId,
          text: inputText,
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

      setInputText("");
      fetchTopics();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`${t('extractFailed')}: ${message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddManual = () => {
    if (!canAddTopic) {
      toast.error(t('topicLimitReached'));
      return;
    }
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) toast.error(t('deleteFailed'));
    else {
      toast.success(t('topicDeleted'));
      fetchTopics();
    }
  };

  const startEdit = (topic: Topic) => {
    setEditingTopic(topic.id);
    setEditForm({
      title: topic.title,
      difficulty_weight: topic.difficulty_weight,
      exam_importance: topic.exam_importance,
      status: topic.status,
    });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("topics").update(editForm).eq("id", id);
    if (error) toast.error(t('updateFailed'));
    else {
      setEditingTopic(null);
      fetchTopics();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("topics").update({ 
      status,
      is_completed: status === 'done',
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error(t('statusUpdateFailed'));
    else fetchTopics();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
            <CheckCircle2 className="w-3 h-3" />
            {t('high')}
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
            <AlertCircle className="w-3 h-3" />
            {t('low')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50">
            <HelpCircle className="w-3 h-3" />
            {t('medium')}
          </Badge>
        );
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const completedCount = topics.filter(t => t.status === 'done').length;
  const lowConfidenceCount = topics.filter(t => t.confidence_level === 'low').length;

  return (
    <div className="space-y-6" dir={dir}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('addContent')}</CardTitle>
            <CardDescription>{t('pasteForAI')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={t('pasteSyllabusHere')}
              className="min-h-[200px]"
              dir="auto"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <Button onClick={handleExtract} disabled={isExtracting} className="w-full">
              {isExtracting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('extractingWithAI')}
                </>
              ) : (
                <>
                  <Wand2 className="me-2 h-4 w-4" />
                  {t('extractWithAI')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t('progressOverview')}</CardTitle>
            <CardDescription>{t('trackCompletion')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{completedCount} / {topics.length}</span>
                <span className="text-muted-foreground">{t('topicsCompleted')}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${topics.length > 0 ? (completedCount / topics.length) * 100 : 0}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-2 rounded bg-muted">
                  <div className="font-bold">{topics.filter(t => t.status === 'not_started').length}</div>
                  <div className="text-muted-foreground">{t('notStarted')}</div>
                </div>
                <div className="p-2 rounded bg-yellow-500/10">
                  <div className="font-bold">{topics.filter(t => t.status === 'in_progress').length}</div>
                  <div className="text-muted-foreground">{t('inProgress')}</div>
                </div>
                <div className="p-2 rounded bg-green-500/10">
                  <div className="font-bold">{completedCount}</div>
                  <div className="text-muted-foreground">{t('done')}</div>
                </div>
              </div>
              
              {lowConfidenceCount > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{lowConfidenceCount} {t('needsReview')}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topics List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('topicsCount')} ({topics.length})</CardTitle>
            <CardDescription>{t('reviewTopics')}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddManual} disabled={!canAddTopic}>
            <Plus className="h-4 w-4 me-1" />
            {t('addManualTopic')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">{t('status')}</TableHead>
                  <TableHead>{t('title')}</TableHead>
                  <TableHead className="w-[90px]">{t('confidence')}</TableHead>
                  <TableHead className="w-[100px]">{t('source')}</TableHead>
                  <TableHead className="w-[70px]">{t('difficulty')}</TableHead>
                  <TableHead className="w-[70px]">{t('importance')}</TableHead>
                  <TableHead className="w-[60px]">{t('score')}</TableHead>
                  <TableHead className="w-[80px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((topic) => (
                  <TableRow key={topic.id} className={topic.status === 'done' ? 'bg-muted/30' : topic.confidence_level === 'low' ? 'bg-amber-50/50' : ''}>
                    <TableCell>
                      <Select 
                        value={topic.status} 
                        onValueChange={(v) => updateStatus(topic.id, v)}
                      >
                        <SelectTrigger className="w-[40px] h-8 p-0 border-0">
                          <SelectValue>
                            {getStatusIcon(topic.status)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">{t('notStarted')}</SelectItem>
                          <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                          <SelectItem value="done">{t('done')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {editingTopic === topic.id ? (
                        <Input
                          value={editForm.title}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          dir="auto"
                        />
                      ) : (
                        <span className={topic.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                          {topic.title}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getConfidenceBadge(topic.confidence_level)}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help">
                              {topic.source_page ? (
                                <>
                                  <FileText className="w-3 h-3" />
                                  <span>{t('page')} {topic.source_page}</span>
                                </>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            {topic.source_context ? (
                              <p className="text-xs" dir="auto">"{topic.source_context}"</p>
                            ) : (
                              <p className="text-xs">{t('noSourceContext')}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {editingTopic === topic.id ? (
                        <Input
                          type="number"
                          min="1" max="5"
                          className="w-14"
                          value={editForm.difficulty_weight}
                          onChange={(e) => setEditForm({...editForm, difficulty_weight: parseInt(e.target.value)})}
                        />
                      ) : (
                        <Badge variant="outline">{topic.difficulty_weight}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTopic === topic.id ? (
                        <Input
                          type="number"
                          min="1" max="5"
                          className="w-14"
                          value={editForm.exam_importance}
                          onChange={(e) => setEditForm({...editForm, exam_importance: parseInt(e.target.value)})}
                        />
                      ) : (
                        <Badge variant="outline">{topic.exam_importance}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {topic.difficulty_weight * topic.exam_importance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1 rtl:space-x-reverse">
                        {editingTopic === topic.id ? (
                          <Button size="icon" variant="ghost" onClick={() => saveEdit(topic.id)}>
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => startEdit(topic)}>
                              <span className="sr-only">Edit</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(topic.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {topics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {t('noTopicsYet')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddTopicDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        courseId={courseId}
        topicsCount={topics.length}
        onSuccess={fetchTopics}
      />
    </div>
  );
}