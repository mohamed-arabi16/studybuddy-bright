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
import { Search, Infinity, Pencil, RotateCcw, Crown } from "lucide-react";
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
  plan_limits: {
    courses: number;
    topics_per_course: number;
    ai_extractions: number;
  };
  quota_overrides: {
    courses?: number;
    topics_per_course?: number;
    ai_extractions?: number;
  } | null;
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
  const [aiExtractions, setAiExtractions] = useState(5);

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

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('user_id, plans(limits)')
      .in('user_id', userIds);

    const { data: overrides } = await supabase
      .from('admin_overrides')
      .select('user_id, quota_overrides')
      .in('user_id', userIds);

    const mapped = profiles.map((p: any) => {
      const sub = subscriptions?.find(s => s.user_id === p.user_id);
      const override = overrides?.find(o => o.user_id === p.user_id);
      
      const defaultLimits = { courses: 2, topics_per_course: 10, ai_extractions: 5 };
      
      return {
        user_id: p.user_id,
        email: p.email,
        plan_limits: (sub?.plans as any)?.limits || defaultLimits,
        quota_overrides: override?.quota_overrides as any || null,
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
    setAiExtractions(currentLimits.ai_extractions || 5);
    
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
        ai_extractions: aiExtractions,
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

      toast({ title: "Success", description: "Quotas updated for user" });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quotas & Overrides</h1>
        <Badge variant="outline">{users.filter(u => u.quota_overrides).length} active overrides</Badge>
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

      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">User</TableHead>
              <TableHead className="w-48">Plan Limits</TableHead>
              <TableHead className="w-56">Active Override</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatLimit(user.plan_limits?.courses)} courses</span>
                      <span>•</span>
                      <span>{formatLimit(user.plan_limits?.topics_per_course)} topics</span>
                      <span>•</span>
                      <span>{formatLimit(user.plan_limits?.ai_extractions)} AI</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.quota_overrides ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          Override Active
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({formatLimit(user.quota_overrides.courses)} / {formatLimit(user.quota_overrides.topics_per_course)} / {formatLimit(user.quota_overrides.ai_extractions)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {user.quota_overrides && (
                      <Button variant="ghost" size="sm" onClick={() => clearOverride(user.user_id)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    )}
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
            <DialogTitle>Edit Quotas</DialogTitle>
            <DialogDescription>
              Set custom limits for <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
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

            <div className="space-y-2">
              <Label>AI Extractions per Month</Label>
              <Input
                type="number"
                value={aiExtractions}
                onChange={(e) => setAiExtractions(parseInt(e.target.value) || 0)}
                min={0}
              />
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