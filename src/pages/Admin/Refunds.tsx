import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface RefundEligibility {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  subscription_id: string;
  subscription_status: string;
  subscription_started: string;
  plan_name: string | null;
  refund_window_expires: string;
  within_refund_window: boolean;
  days_remaining: number | null;
  is_first_pro_purchase: boolean;
  syllabus_extractions_count: number;
  past_exam_analyses_completed: number;
  quizzes_generated_count: number;
  topic_deepdives_count: number;
  calendar_events_synced_count: number;
  pro_courses_created_count: number;
  exports_count: number;
  syllabus_limit_exceeded: boolean;
  past_exam_limit_exceeded: boolean;
  quizzes_limit_exceeded: boolean;
  deepdives_limit_exceeded: boolean;
  calendar_limit_exceeded: boolean;
  courses_limit_exceeded: boolean;
  exports_limit_exceeded: boolean;
  is_refund_eligible: boolean;
  refund_requested_at: string | null;
  refund_approved_at: string | null;
  refund_denied_at: string | null;
  refund_denial_reason: string | null;
}

interface UsageCounterProps {
  label: string;
  current: number;
  limit: number;
  exceeded: boolean;
}

function UsageCounter({ label, current, limit, exceeded }: UsageCounterProps) {
  const percentage = Math.min((current / limit) * 100, 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={exceeded ? "text-destructive font-medium" : "text-foreground"}>
          {current}/{limit}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${exceeded ? "[&>div]:bg-destructive" : ""}`}
      />
    </div>
  );
}

export default function AdminRefunds() {
  const { t, dir, language } = useLanguage();
  const [eligibilityData, setEligibilityData] = useState<RefundEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "eligible" | "requested" | "processed">("all");
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<RefundEligibility | null>(null);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchEligibilityData();
  }, []);

  const fetchEligibilityData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_refund_eligibility")
        .select("*")
        .order("subscription_started", { ascending: false });

      if (error) {
        console.error("Error fetching refund eligibility:", error);
        toast.error(language === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data');
        return;
      }

      setEligibilityData(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRefund = async (user: RefundEligibility) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("subscription_usage")
        .update({
          refund_approved_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تمت الموافقة على الاسترداد' : 'Refund approved');
      fetchEligibilityData();
    } catch (err) {
      console.error("Error approving refund:", err);
      toast.error(language === 'ar' ? 'فشل في الموافقة' : 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleDenyRefund = async () => {
    if (!selectedUser || !denyReason.trim()) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("subscription_usage")
        .update({
          refund_denied_at: new Date().toISOString(),
          refund_denial_reason: denyReason.trim(),
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم رفض الاسترداد' : 'Refund denied');
      setDenyDialogOpen(false);
      setDenyReason("");
      setSelectedUser(null);
      fetchEligibilityData();
    } catch (err) {
      console.error("Error denying refund:", err);
      toast.error(language === 'ar' ? 'فشل في الرفض' : 'Failed to deny');
    } finally {
      setProcessing(false);
    }
  };

  const filteredData = eligibilityData.filter(user => {
    // Search filter
    const searchMatch = 
      !searchQuery ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let statusMatch = true;
    if (filter === "eligible") {
      statusMatch = user.is_refund_eligible;
    } else if (filter === "requested") {
      statusMatch = !!user.refund_requested_at && !user.refund_approved_at && !user.refund_denied_at;
    } else if (filter === "processed") {
      statusMatch = !!user.refund_approved_at || !!user.refund_denied_at;
    }

    return searchMatch && statusMatch;
  });

  const getStatusBadge = (user: RefundEligibility) => {
    if (user.refund_approved_at) {
      return <Badge variant="default" className="bg-green-600">{language === 'ar' ? 'تمت الموافقة' : 'Approved'}</Badge>;
    }
    if (user.refund_denied_at) {
      return <Badge variant="destructive">{language === 'ar' ? 'مرفوض' : 'Denied'}</Badge>;
    }
    if (user.is_refund_eligible) {
      return <Badge variant="default" className="bg-emerald-500">{language === 'ar' ? 'مؤهل' : 'Eligible'}</Badge>;
    }
    return <Badge variant="secondary">{language === 'ar' ? 'غير مؤهل' : 'Ineligible'}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {language === 'ar' ? 'إدارة طلبات الاسترداد' : 'Refund Management'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'تتبع أهلية الاسترداد وإدارة الطلبات' 
            : 'Track refund eligibility and manage requests'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute ${dir === 'rtl' ? 'end-3' : 'start-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <Input
            placeholder={language === 'ar' ? 'بحث بالبريد أو الاسم...' : 'Search by email or name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={dir === 'rtl' ? 'pe-9' : 'ps-9'}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: language === 'ar' ? 'الكل' : 'All' },
            { value: "eligible", label: language === 'ar' ? 'مؤهلون' : 'Eligible' },
            { value: "requested", label: language === 'ar' ? 'طلبات معلقة' : 'Pending' },
            { value: "processed", label: language === 'ar' ? 'تمت معالجتها' : 'Processed' },
          ].map(opt => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(opt.value as typeof filter)}
            >
              {opt.label}
            </Button>
          ))}
          
          <Button variant="ghost" size="sm" onClick={fetchEligibilityData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{eligibilityData.length}</div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'إجمالي الاشتراكات' : 'Total Subscriptions'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">
              {eligibilityData.filter(u => u.is_refund_eligible).length}
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'مؤهلون للاسترداد' : 'Eligible for Refund'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {eligibilityData.filter(u => u.refund_approved_at).length}
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'تمت الموافقة' : 'Approved'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">
              {eligibilityData.filter(u => u.refund_denied_at).length}
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'مرفوضة' : 'Denied'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredData.map(user => (
          <Card 
            key={user.id} 
            className={`${
              user.is_refund_eligible 
                ? "border-emerald-500/50" 
                : user.refund_approved_at 
                  ? "border-green-500/50"
                  : user.refund_denied_at 
                    ? "border-destructive/50"
                    : "border-border"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    {user.display_name || user.full_name || user.email?.split('@')[0]}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {user.email}
                  </CardDescription>
                </div>
                {getStatusBadge(user)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subscription Info */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {user.within_refund_window ? (
                    <span className="text-emerald-600">
                      {language === 'ar' 
                        ? `${Math.ceil(user.days_remaining || 0)} أيام متبقية`
                        : `${Math.ceil(user.days_remaining || 0)} days left`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {language === 'ar' ? 'انتهت الفترة' : 'Window expired'}
                    </span>
                  )}
                </span>
              </div>

              {/* First Purchase Check */}
              <div className="flex items-center gap-2 text-sm">
                {user.is_first_pro_purchase ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>{language === 'ar' ? 'أول شراء' : 'First purchase'}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span>{language === 'ar' ? 'ليس أول شراء' : 'Not first purchase'}</span>
                  </>
                )}
              </div>

              {/* Usage Limits */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {language === 'ar' ? 'حدود الاستخدام' : 'Usage Limits'}
                </p>
                <div className="space-y-2">
                  <UsageCounter
                    label={language === 'ar' ? 'استخراج المنهج' : 'Syllabus Extractions'}
                    current={user.syllabus_extractions_count}
                    limit={2}
                    exceeded={user.syllabus_limit_exceeded}
                  />
                  <UsageCounter
                    label={language === 'ar' ? 'تحليل الاختبارات' : 'Past Exam Analyses'}
                    current={user.past_exam_analyses_completed}
                    limit={1}
                    exceeded={user.past_exam_limit_exceeded}
                  />
                  <UsageCounter
                    label={language === 'ar' ? 'الاختبارات القصيرة' : 'Quizzes Generated'}
                    current={user.quizzes_generated_count}
                    limit={25}
                    exceeded={user.quizzes_limit_exceeded}
                  />
                  <UsageCounter
                    label={language === 'ar' ? 'تحليل المواضيع' : 'Topic Deep Dives'}
                    current={user.topic_deepdives_count}
                    limit={10}
                    exceeded={user.deepdives_limit_exceeded}
                  />
                  <UsageCounter
                    label={language === 'ar' ? 'أحداث التقويم' : 'Calendar Events'}
                    current={user.calendar_events_synced_count}
                    limit={14}
                    exceeded={user.calendar_limit_exceeded}
                  />
                  <UsageCounter
                    label={language === 'ar' ? 'مواد Pro' : 'Pro Courses'}
                    current={user.pro_courses_created_count}
                    limit={2}
                    exceeded={user.courses_limit_exceeded}
                  />
                </div>
              </div>

              {/* Actions */}
              {!user.refund_approved_at && !user.refund_denied_at && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    disabled={!user.is_refund_eligible || processing}
                    onClick={() => handleApproveRefund(user)}
                  >
                    <CheckCircle className="h-4 w-4 me-1" />
                    {language === 'ar' ? 'موافقة' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={processing}
                    onClick={() => {
                      setSelectedUser(user);
                      setDenyDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 me-1" />
                    {language === 'ar' ? 'رفض' : 'Deny'}
                  </Button>
                </div>
              )}

              {/* Show denial reason if denied */}
              {user.refund_denied_at && user.refund_denial_reason && (
                <div className="p-2 bg-destructive/10 rounded-md">
                  <p className="text-xs text-destructive flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {user.refund_denial_reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
        </div>
      )}

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'رفض طلب الاسترداد' : 'Deny Refund Request'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من رفض طلب ${selectedUser?.email}؟`
                : `Are you sure you want to deny the refund for ${selectedUser?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={language === 'ar' ? 'سبب الرفض...' : 'Reason for denial...'}
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDenyRefund}
              disabled={!denyReason.trim() || processing}
            >
              {language === 'ar' ? 'تأكيد الرفض' : 'Confirm Denial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}