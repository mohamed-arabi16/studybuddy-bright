import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  Coins, 
  TrendingUp, 
  Users, 
  RefreshCw, 
  DollarSign,
  Zap,
  Clock,
  Activity
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface CreditAnalytics {
  action_type: string | null;
  total_events: number | null;
  total_credits: number | null;
  total_cost_usd: number | null;
  avg_latency_ms: number | null;
  avg_tokens_in: number | null;
  avg_tokens_out: number | null;
  median_total_tokens: number | null;
  p95_total_tokens: number | null;
}

interface TopConsumer {
  user_id: string;
  email: string;
  total_credits: number;
  total_events: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function AdminCredits() {
  const { t, dir, language } = useLanguage();
  const isRtl = language === 'ar';
  const [analytics, setAnalytics] = useState<CreditAnalytics[]>([]);
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      // Fetch credit analytics from view
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('admin_credit_analytics')
        .select('*');

      if (analyticsError) {
        console.error('Error fetching analytics:', analyticsError);
        setError(isRtl ? 'فشل في تحميل بيانات التحليلات' : 'Failed to load analytics data');
      } else {
        setAnalytics(analyticsData || []);
      }

      // Fetch top consumers (last 30 days)
      const { data: consumersData, error: consumersError } = await supabase
        .from('credit_usage_events')
        .select('user_id, credits_charged')
        .gte('created_at', new Date(Date.now() - THIRTY_DAYS_MS).toISOString());

      if (consumersError) {
        console.error('Error fetching consumers:', consumersError);
        if (!error) {
          setError(isRtl ? 'فشل في تحميل بيانات المستهلكين' : 'Failed to load consumer data');
        }
      } else if (consumersData) {
        // Aggregate by user
        const userCredits: Record<string, { total_credits: number; total_events: number }> = {};
        consumersData.forEach((event) => {
          if (!userCredits[event.user_id]) {
            userCredits[event.user_id] = { total_credits: 0, total_events: 0 };
          }
          userCredits[event.user_id].total_credits += event.credits_charged;
          userCredits[event.user_id].total_events += 1;
        });

        // Get top 10 consumers
        const topUserIds = Object.entries(userCredits)
          .sort(([, a], [, b]) => b.total_credits - a.total_credits)
          .slice(0, 10)
          .map(([userId]) => userId);

        if (topUserIds.length > 0) {
          // Fetch emails for top consumers
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, email')
            .in('user_id', topUserIds);

          const emailMap: Record<string, string> = {};
          profiles?.forEach((p) => {
            emailMap[p.user_id] = p.email || 'Unknown';
          });

          const consumers: TopConsumer[] = topUserIds.map((userId) => ({
            user_id: userId,
            email: emailMap[userId] || 'Unknown',
            total_credits: userCredits[userId].total_credits,
            total_events: userCredits[userId].total_events,
          }));

          setTopConsumers(consumers);
        }
      }
    } catch (err) {
      console.error('Failed to fetch credit data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate totals
  const totals = analytics.reduce(
    (acc, item) => ({
      totalEvents: acc.totalEvents + (item.total_events || 0),
      totalCredits: acc.totalCredits + (item.total_credits || 0),
      totalCostUsd: acc.totalCostUsd + (item.total_cost_usd || 0),
    }),
    { totalEvents: 0, totalCredits: 0, totalCostUsd: 0 }
  );

  // Prepare chart data
  const barChartData = analytics.map((item) => ({
    name: item.action_type || 'Unknown',
    credits: item.total_credits || 0,
    events: item.total_events || 0,
  }));

  const pieChartData = analytics.map((item) => ({
    name: item.action_type || 'Unknown',
    value: item.total_credits || 0,
  }));

  const formatActionType = (type: string | null) => {
    if (!type) return 'Unknown';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRtl ? 'تحليلات الأرصدة' : 'Credit Analytics'}
            </h1>
            <p className="text-muted-foreground">
              {isRtl ? 'تتبع استخدام الأرصدة والتكاليف' : 'Track credit usage and costs'}
            </p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'} ${refreshing ? 'animate-spin' : ''}`} />
          {isRtl ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isRtl ? 'إجمالي الأحداث' : 'Total Events'}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totals.totalEvents.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'آخر 30 يوم' : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isRtl ? 'إجمالي الأرصدة' : 'Total Credits'}
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totals.totalCredits.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'مستهلكة' : 'Consumed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isRtl ? 'التكلفة الإجمالية' : 'Total Cost'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">${totals.totalCostUsd.toFixed(2)}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'دولار أمريكي' : 'USD'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isRtl ? 'متوسط التكلفة/حدث' : 'Avg Cost/Event'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                ${totals.totalEvents > 0 ? (totals.totalCostUsd / totals.totalEvents).toFixed(4) : '0.00'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'لكل طلب' : 'Per request'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart - Credits by Action Type */}
        <Card>
          <CardHeader>
            <CardTitle>{isRtl ? 'الأرصدة حسب نوع الإجراء' : 'Credits by Action Type'}</CardTitle>
            <CardDescription>
              {isRtl ? 'توزيع استخدام الأرصدة' : 'Credit usage distribution'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : barChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isRtl ? 'لا توجد بيانات' : 'No data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120}
                    tickFormatter={formatActionType}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      value.toLocaleString(),
                      name === 'credits' ? (isRtl ? 'الأرصدة' : 'Credits') : (isRtl ? 'الأحداث' : 'Events')
                    ]}
                    labelFormatter={formatActionType}
                  />
                  <Bar dataKey="credits" fill="#8b5cf6" name="credits" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Credit Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{isRtl ? 'توزيع الأرصدة' : 'Credit Distribution'}</CardTitle>
            <CardDescription>
              {isRtl ? 'النسبة المئوية حسب نوع الإجراء' : 'Percentage by action type'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : pieChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isRtl ? 'لا توجد بيانات' : 'No data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${formatActionType(name)} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((item) => (
                      <Cell key={`cell-${item.name}`} fill={COLORS[pieChartData.indexOf(item) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value.toLocaleString(), isRtl ? 'الأرصدة' : 'Credits']}
                    labelFormatter={formatActionType}
                  />
                  <Legend formatter={formatActionType} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isRtl ? 'تفاصيل الاستخدام' : 'Usage Details'}</CardTitle>
          <CardDescription>
            {isRtl ? 'مقاييس مفصلة حسب نوع الإجراء' : 'Detailed metrics by action type'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : analytics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isRtl ? 'لا توجد بيانات استخدام' : 'No usage data available'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-3 font-medium">{isRtl ? 'نوع الإجراء' : 'Action Type'}</th>
                    <th className="text-start p-3 font-medium">{isRtl ? 'الأحداث' : 'Events'}</th>
                    <th className="text-start p-3 font-medium">{isRtl ? 'الأرصدة' : 'Credits'}</th>
                    <th className="text-start p-3 font-medium">{isRtl ? 'التكلفة' : 'Cost (USD)'}</th>
                    <th className="text-start p-3 font-medium">{isRtl ? 'متوسط الاستجابة' : 'Avg Latency'}</th>
                    <th className="text-start p-3 font-medium">{isRtl ? 'متوسط التوكنات' : 'Avg Tokens'}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono">
                          {formatActionType(item.action_type)}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium">{(item.total_events || 0).toLocaleString()}</td>
                      <td className="p-3 font-medium">{(item.total_credits || 0).toLocaleString()}</td>
                      <td className="p-3 text-green-600 font-medium">${(item.total_cost_usd || 0).toFixed(4)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {(item.avg_latency_ms || 0).toFixed(0)}ms
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          {((item.avg_tokens_in || 0) + (item.avg_tokens_out || 0)).toFixed(0)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Consumers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isRtl ? 'أكثر المستهلكين' : 'Top Consumers'}
          </CardTitle>
          <CardDescription>
            {isRtl ? 'المستخدمون الذين استهلكوا أكثر الأرصدة في آخر 30 يوم' : 'Users who consumed the most credits in the last 30 days'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : topConsumers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isRtl ? 'لا يوجد مستهلكون بعد' : 'No consumers yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {topConsumers.map((consumer, index) => (
                <div
                  key={consumer.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[200px]" title={consumer.email}>
                        {consumer.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {consumer.total_events} {isRtl ? 'حدث' : 'events'}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-primary">{consumer.total_credits.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? 'رصيد' : 'credits'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
