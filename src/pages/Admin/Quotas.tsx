import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Infinity, Pencil, RotateCcw, Crown, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type UserQuota = {
  user_id: string;
  email: string;
  plan_tier: string;
  credit_balance: number;
  monthly_allowance: number;
  plan_limits: {
    courses: number;
    topics_per_course: number;
  };
  quota_overrides: {
    courses?: number;
    topics_per_course?: number;
    credit_balance?: number;
    credit_allowance?: number;
  } | null;
  has_override: boolean;
};

export default function AdminQuotas() {
  const [users, setUsers] = useState<UserQuota[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  // Form state
  const [unlimitedCourses, setUnlimitedCourses] = useState(false);
  const [unlimitedTopics, setUnlimitedTopics] = useState(false);
  const [courses, setCourses] = useState(2);
  const [topicsPerCourse, setTopicsPerCourse] = useState(10);
  const [creditBalance, setCreditBalance] = useState(100);
  const [creditAllowance, setCreditAllowance] = useState(100);

  useEffect(() => {
    fetchQuotas();
  }, []);

  async function fetchQuotas() {
    setLoading(true);
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email');

    if (!profiles) {
      setLoading(false);
      return;
    }

    const userIds = profiles.map(p => p.user_id);

    // Get subscriptions for plan limits
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('user_id, plans(limits)')
      .in('user_id', userIds);

    // Get admin overrides
    const { data: overrides } = await supabase
      .from('admin_overrides')
      .select('user_id, quota_overrides')
      .in('user_id', userIds);

    // Get user credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('user_id, balance, monthly_allowance, plan_tier')
      .in('user_id', userIds);

    const mapped = profiles.map((p: any) => {
      const sub = subscriptions?.find(s => s.user_id === p.user_id);
      const override = overrides?.find(o => o.user_id === p.user_id);
      const credit = credits?.find(c => c.user_id === p.user_id);
      
      const defaultLimits = { courses: 2, topics_per_course: 10 };
      const quotaOverrides = override?.quota_overrides as any || null;
      
      return {
        user_id: p.user_id,
        email: p.email,
        plan_tier: credit?.plan_tier || 'free',
        credit_balance: credit?.balance || 0,
        monthly_allowance: credit?.monthly_allowance || 100,
        plan_limits: (sub?.plans as any)?.limits || defaultLimits,
        quota_overrides: quotaOverrides,
        has_override: !!quotaOverrides && Object.keys(quotaOverrides).length > 0,
      };
    });
    
    setUsers(mapped);
    setLoading(false);
  }

  const filteredUsers = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(user: UserQuota) {
    setSelectedUser(user);
    const currentLimits = user.quota_overrides || user.plan_limits;
    
    setUnlimitedCourses(currentLimits.courses === -1);
    setUnlimitedTopics(currentLimits.topics_per_course === -1);
    setCourses(currentLimits.courses === -1 ? 2 : currentLimits.courses || 2);
    setTopicsPerCourse(currentLimits.topics_per_course === -1 ? 10 : currentLimits.topics_per_course || 10);
    setCreditBalance(user.quota_overrides?.credit_balance || user.credit_balance || 100);
    setCreditAllowance(user.quota_overrides?.credit_allowance || user.monthly_allowance || 100);
    
    setShowDialog(true);
  }

  async function saveOverride() {
    if (!selectedUser) return;
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      const newLimits = {
        courses: unlimitedCourses ? -1 : courses,
        topics_per_course: unlimitedTopics ? -1 : topicsPerCourse,
        credit_balance: creditBalance,
        credit_allowance: creditAllowance,
      };

      const { error } = await supabase
        .from('admin_overrides')
        .upsert({
          user_id: selectedUser.user_id,
          quota_overrides: newLimits,
          created_by: currentUser.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({ title: "Success", description: "Quotas and credits updated for user" });
      setShowDialog(false);
      fetchQuotas();

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function clearOverride(userId: string) {
    const { error } = await supabase
      .from('admin_overrides')
      .delete()
      .eq('user_id', userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Override removed" });
      fetchQuotas();
    }
  }

  function formatLimit(value: number | undefined) {
    if (value === undefined) return '-';
    return value === -1 ? <Infinity className="h-4 w-4 inline" /> : value;
  }

  function getTierBadge(tier: string) {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      pro: "default",
      trial: "secondary",
      free: "outline",
    };
    return (
      <Badge variant={variants[tier] || "outline"} className="uppercase text-xs">
        {tier}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quotas & AI Credits</h1>
        <Badge variant="outline">{users.filter(u => u.has_override).length} active overrides</Badge>
      </div>
      
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search user..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-x-auto" dir="ltr">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-64 px-4 py-3 text-sm text-gray-400">User</TableHead>
              <TableHead className="w-24 px-4 py-3 text-sm text-gray-400">Plan</TableHead>
              <TableHead className="w-40 px-4 py-3 text-sm text-gray-400">AI Credits</TableHead>
              <TableHead className="w-52 px-4 py-3 text-sm text-gray-400">Limits</TableHead>
              <TableHead className="w-32 px-4 py-3 text-sm text-gray-400">Override</TableHead>
              <TableHead className="w-44 px-4 py-3 text-right text-sm text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-white/5">
                  <TableCell className="py-4"><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.user_id} className="hover:bg-muted/30 border-b border-white/5">
                  <TableCell className="px-4 py-4 text-left">
                    <span className="font-medium truncate block max-w-[240px]" dir="ltr" title={user.email}>
                      {user.email}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {getTierBadge(user.plan_tier)}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-mono text-sm">
                        {user.credit_balance} / {user.monthly_allowance}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span className="whitespace-nowrap">{formatLimit(user.plan_limits?.courses)} courses</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{formatLimit(user.plan_limits?.topics_per_course)} topics</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {user.has_override ? (
                      <Badge variant="default" className="flex items-center gap-1 whitespace-nowrap w-fit">
                        <Crown className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {user.has_override && (
                        <Button variant="ghost" size="sm" onClick={() => clearOverride(user.user_id)}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Quotas & Credits</DialogTitle>
            <DialogDescription>
              Set custom limits for <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* AI Credits Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                AI Credits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Balance</Label>
                  <Input
                    type="number"
                    value={creditBalance}
                    onChange={(e) => setCreditBalance(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Allowance</Label>
                  <Input
                    type="number"
                    value={creditAllowance}
                    onChange={(e) => setCreditAllowance(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Course Limits Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Courses Limit</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Unlimited</span>
                  <Switch
                    checked={unlimitedCourses}
                    onCheckedChange={setUnlimitedCourses}
                  />
                </div>
              </div>
              {!unlimitedCourses && (
                <Input
                  type="number"
                  value={courses}
                  onChange={(e) => setCourses(parseInt(e.target.value) || 0)}
                  min={1}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Topics per Course</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Unlimited</span>
                  <Switch
                    checked={unlimitedTopics}
                    onCheckedChange={setUnlimitedTopics}
                  />
                </div>
              </div>
              {!unlimitedTopics && (
                <Input
                  type="number"
                  value={topicsPerCourse}
                  onChange={(e) => setTopicsPerCourse(parseInt(e.target.value) || 0)}
                  min={1}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveOverride}>
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
