import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, BookOpen, FileText, Sparkles, Crown, Clock,
  RefreshCw,
  TrendingUp, TrendingDown, BarChart3, Zap
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";

interface HealthStatus {
  database: { status: string; latency: number };
  ai: { status: string; latency: number };
  storage: { status: string; used: number; available: boolean };
}

interface DailySignup {
  date: string;
  signups: number;
}

interface TopUser {
  user_id: string;
  email: string;
  display_name: string | null;
  joined: string;
  courses: number;
  topics: number;
  ai_requests: number;
}

interface AIUsage {
  type: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
}

interface WeeklyComparison {
  users: { thisWeek: number; lastWeek: number; change: number };
  aiJobs: { thisWeek: number; lastWeek: number; change: number };
}

interface Totals {
  users: number;
  courses: number;
  topics: number;
  activeSubs: number;
  trialingUsers: number;
  proOverrides: number;
  aiJobsToday: number;
}

interface AdminStats {
  totals: Totals;
  dailySignups: DailySignup[];
  topUsers: TopUser[];
  aiUsage: AIUsage[];
  weeklyComparison: WeeklyComparison;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function AdminDashboard() {
  const { t, dir, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    activeSubs: 0,
    trialingUsers: 0,
    proOverrides: 0,
    totalCourses: 0,
    totalTopics: 0,
    aiJobsToday: 0,
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [chartData, setChartData] = useState<AdminStats | null>(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-health-check');
      if (error) throw error;
      setHealth(data);
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('admin-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      setChartData(data);
      
      // Update stats from the edge function response (bypasses RLS)
      if (data?.totals) {
        setStats({
          users: data.totals.users,
          activeSubs: data.totals.activeSubs,
          trialingUsers: data.totals.trialingUsers,
          proOverrides: data.totals.proOverrides,
          totalCourses: data.totals.courses,
          totalTopics: data.totals.topics,
          aiJobsToday: data.totals.aiJobsToday,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllStats();
    fetchHealth();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      connected: "default", online: "default", available: "default",
      degraded: "secondary", error: "destructive", offline: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const statCards = [
    { title: t('totalUsers'), value: stats.users, icon: Users, description: t('registered'), color: "text-blue-500" },
    { title: t('proUsers'), value: stats.activeSubs + stats.proOverrides, icon: Crown, description: `${t('paid')} + ${stats.proOverrides} ${t('overrides')}`, color: "text-amber-500" },
    { title: t('onTrial'), value: stats.trialingUsers, icon: Clock, description: t('activeTrials'), color: "text-green-500" },
    { title: t('totalCourses'), value: stats.totalCourses, icon: BookOpen, description: t('created'), color: "text-purple-500" },
    { title: t('totalTopics'), value: stats.totalTopics, icon: FileText, description: t('acrossAll'), color: "text-pink-500" },
    { title: t('aiJobs24h'), value: stats.aiJobsToday, icon: Zap, description: t('todayLabel'), color: "text-orange-500" },
  ];

  const chartConfig = { signups: { label: t('signups30Days'), color: "hsl(var(--primary))" } };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('adminOverview')}</h1>
          <p className="text-muted-foreground">{t('adminPanel')}</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <TrendingUp className="h-3 w-3" />{t('liveStats')}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-12" /></CardContent></Card>
        )) : statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Comparison */}
      {chartData?.weeklyComparison && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">{t('usersThisWeek')}</CardTitle>
              {chartData.weeklyComparison.users.change >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chartData.weeklyComparison.users.thisWeek}</div>
              <p className="text-xs text-muted-foreground">{chartData.weeklyComparison.users.change >= 0 ? '+' : ''}{chartData.weeklyComparison.users.change}% {t('fromLastWeek')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">{t('aiJobsThisWeek')}</CardTitle>
              {chartData.weeklyComparison.aiJobs.change >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chartData.weeklyComparison.aiJobs.thisWeek}</div>
              <p className="text-xs text-muted-foreground">{chartData.weeklyComparison.aiJobs.change >= 0 ? '+' : ''}{chartData.weeklyComparison.aiJobs.change}% {t('fromLastWeek')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{t('signups30Days')}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[200px]" /> : chartData?.dailySignups ? (
              <ChartContainer config={chartConfig} className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.dailySignups}>
                    <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en', { month: 'short', day: 'numeric' })} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="signups" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : <p className="text-muted-foreground text-center py-8">{t('noData')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />{t('aiUsage')}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[200px]" /> : chartData?.aiUsage?.length ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-[160px] w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={chartData.aiUsage} dataKey="total" nameKey="type" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                      {chartData.aiUsage.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {chartData.aiUsage.map((item, i) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="capitalize">{item.type.replace(/-/g, ' ')}</span>
                      </div>
                      <span className="font-medium">{item.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-muted-foreground text-center py-8">{t('noAiJobs')}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Top Users */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{t('topActiveUsers')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <Skeleton className="h-48" /> : chartData?.topUsers?.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>{t('user')}</TableHead><TableHead className="text-center">{t('courses')}</TableHead><TableHead className="text-center">{t('topics')}</TableHead><TableHead className="text-center">AI</TableHead></TableRow></TableHeader>
              <TableBody>
                {chartData.topUsers.slice(0, 8).map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell><p className="font-medium">{u.display_name || t('noName')}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                    <TableCell className="text-center">{u.courses}</TableCell>
                    <TableCell className="text-center">{u.topics}</TableCell>
                    <TableCell className="text-center">{u.ai_requests}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-muted-foreground text-center py-8">{t('noData')}</p>}
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>{t('systemHealth')}</CardTitle><CardDescription>{t('backendStatus')}</CardDescription></div>
            <Button variant="ghost" size="icon" onClick={fetchHealth} disabled={healthLoading}>
              <RefreshCw className={`h-4 w-4 ${healthLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthLoading ? <Skeleton className="h-20" /> : health ? (
              <>
                <div className="flex justify-between"><span>{t('database')}</span><div className="flex gap-2">{health.database.latency}ms {getStatusBadge(health.database.status)}</div></div>
                <div className="flex justify-between"><span>{t('aiService')}</span><div className="flex gap-2">{health.ai.latency}ms {getStatusBadge(health.ai.status)}</div></div>
                <div className="flex justify-between"><span>{t('storage')}</span><div className="flex gap-2">{health.storage.used} {t('filesCount')} {getStatusBadge(health.storage.status)}</div></div>
              </>
            ) : <p className="text-muted-foreground">{t('unableToFetch')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('quickStats')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between"><span>{t('avgTopicsPerCourse')}</span><span className="font-bold">{stats.totalCourses > 0 ? (stats.totalTopics / stats.totalCourses).toFixed(1) : 0}</span></div>
            <div className="flex justify-between"><span>{t('avgCoursesPerUser')}</span><span className="font-bold">{stats.users > 0 ? (stats.totalCourses / stats.users).toFixed(1) : 0}</span></div>
            <div className="flex justify-between"><span>{t('proConversion')}</span><span className="font-bold">{stats.users > 0 ? ((stats.activeSubs + stats.proOverrides) / stats.users * 100).toFixed(1) : 0}%</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
