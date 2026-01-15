import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare, Trash2, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface Feedback {
  id: string;
  user_id: string;
  email: string | null;
  feedback_type: string;
  message: string;
  rating: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { t } = useLanguage();

  const fetchFeedbacks = async () => {
    setLoading(true);
    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching feedback:', error);
      toast.error(t('error'));
    } else {
      setFeedbacks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('feedback')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error(t('error'));
    } else {
      toast.success(t('statusUpdated'));
      fetchFeedbacks();
    }
  };

  const saveNotes = async () => {
    if (!selectedFeedback) return;
    
    const { error } = await supabase
      .from('feedback')
      .update({ admin_notes: adminNotes })
      .eq('id', selectedFeedback.id);

    if (error) {
      toast.error(t('error'));
    } else {
      toast.success(t('notesSaved'));
      setSelectedFeedback(null);
      fetchFeedbacks();
    }
  };

  const deleteFeedback = async (id: string) => {
    if (!confirm(t('confirmDeleteFeedback'))) return;
    
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(t('error'));
    } else {
      toast.success(t('feedbackDeleted'));
      fetchFeedbacks();
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'bug': return 'destructive';
      case 'feature': return 'secondary';
      case 'improvement': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'reviewed': return 'secondary';
      case 'resolved': return 'outline';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return t('bug');
      case 'feature': return t('feature');
      case 'improvement': return t('improvement');
      default: return t('other');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return t('new');
      case 'reviewed': return t('reviewed');
      case 'resolved': return t('resolved');
      default: return t('other');
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-sm">{t('noRating')}</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('userFeedback')}</h1>
          <p className="text-muted-foreground">
            {feedbacks.length} {t('feedbackSubmissions')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="new">{t('new')}</SelectItem>
              <SelectItem value="reviewed">{t('reviewed')}</SelectItem>
              <SelectItem value="resolved">{t('resolved')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchFeedbacks}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('noFeedbackYet')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getTypeBadgeVariant(feedback.feedback_type)}>
                        {getTypeLabel(feedback.feedback_type)}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(feedback.status)}>
                        {getStatusLabel(feedback.status)}
                      </Badge>
                      {renderStars(feedback.rating)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feedback.email || t('unknownUser')} • {format(new Date(feedback.created_at), 'PPp')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setAdminNotes(feedback.admin_notes || '');
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteFeedback(feedback.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
                {feedback.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">{t('adminNotes')}:</p>
                    <p className="text-sm text-muted-foreground">{feedback.admin_notes}</p>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(feedback.id, 'reviewed')}
                    disabled={feedback.status === 'reviewed'}
                  >
                    {t('markReviewed')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(feedback.id, 'resolved')}
                    disabled={feedback.status === 'resolved'}
                  >
                    {t('markResolved')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('feedbackDetails')}</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">{t('from')}</p>
                <p className="text-muted-foreground">{selectedFeedback.email || t('unknownUser')}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">{t('message')}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{selectedFeedback.message}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('adminNotes')}</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t('addInternalNotes')}
                  rows={3}
                />
              </div>
              <Button onClick={saveNotes} className="w-full">
                {t('saveNotes')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
