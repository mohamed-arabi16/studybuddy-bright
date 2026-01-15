import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Shield, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string;
  actor_role: string;
  target_user_id: string | null;
  action_type: string;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  GRANT_OVERRIDE: "bg-green-500/20 text-green-400 border-green-500/30",
  UPDATE_OVERRIDE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  REVOKE_OVERRIDE: "bg-red-500/20 text-red-400 border-red-500/30",
  GRANT_ROLE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  REVOKE_ROLE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DISABLE_USER: "bg-red-500/20 text-red-400 border-red-500/30",
  ENABLE_USER: "bg-green-500/20 text-green-400 border-green-500/30",
  CREATE_PROMO: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  UPDATE_PROMO: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DELETE_PROMO: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PAGE_SIZE = 20;

export default function AuditLog() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isRtl = language === 'ar';

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq('action_type', actionFilter);
      }

      if (searchQuery) {
        query = query.or(`actor_id.ilike.%${searchQuery}%,target_user_id.ilike.%${searchQuery}%`);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }

      setLogs((data as AuditLog[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const actionTypes = [
    "all",
    "GRANT_OVERRIDE",
    "UPDATE_OVERRIDE",
    "REVOKE_OVERRIDE",
    "GRANT_ROLE",
    "REVOKE_ROLE",
    "DISABLE_USER",
    "ENABLE_USER",
    "CREATE_PROMO",
    "UPDATE_PROMO",
    "DELETE_PROMO",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRtl ? 'سجل التدقيق' : 'Audit Log'}
            </h1>
            <p className="text-muted-foreground">
              {isRtl ? 'تتبع جميع الإجراءات الإدارية' : 'Track all administrative actions'}
            </p>
          </div>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'} ${loading ? 'animate-spin' : ''}`} />
          {isRtl ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <Input
                  placeholder={isRtl ? 'بحث بمعرف المستخدم...' : 'Search by user ID...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={isRtl ? 'pr-10' : 'pl-10'}
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={isRtl ? 'نوع الإجراء' : 'Action Type'} />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? (isRtl ? 'الكل' : 'All') : type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              {isRtl ? 'بحث' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isRtl ? 'السجلات' : 'Logs'}</span>
            <Badge variant="secondary">{totalCount} {isRtl ? 'إجمالي' : 'total'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isRtl ? 'لا توجد سجلات' : 'No audit logs found'}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                    <div className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors">
                      <CollapsibleTrigger
                        className="w-full"
                        onClick={() => toggleRow(log.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={ACTION_TYPE_COLORS[log.action_type] || ""}
                            >
                              {log.action_type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(log.created_at), 'PPpp')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {log.actor_role}
                            </Badge>
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(log.id) ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-muted-foreground">{isRtl ? 'المنفذ:' : 'Actor:'}</span>
                              <p className="font-mono text-xs break-all">{log.actor_id}</p>
                            </div>
                            {log.target_user_id && (
                              <div>
                                <span className="text-muted-foreground">{isRtl ? 'المستهدف:' : 'Target:'}</span>
                                <p className="font-mono text-xs break-all">{log.target_user_id}</p>
                              </div>
                            )}
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div>
                              <span className="text-muted-foreground">{isRtl ? 'البيانات:' : 'Metadata:'}</span>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.request_id && (
                            <div>
                              <span className="text-muted-foreground">{isRtl ? 'معرف الطلب:' : 'Request ID:'}</span>
                              <p className="font-mono text-xs">{log.request_id}</p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {isRtl 
                  ? `صفحة ${page + 1} من ${totalPages}` 
                  : `Page ${page + 1} of ${totalPages}`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
