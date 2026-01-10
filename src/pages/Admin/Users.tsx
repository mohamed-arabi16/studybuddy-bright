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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Crown, Clock, Settings, RotateCcw, Search, UserCog, Shield, ShieldOff } from "lucide-react";
import AdminSubscriptionDialog from "@/components/AdminSubscriptionDialog";
import { Skeleton } from "@/components/ui/skeleton";

type User = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  phone_number: string | null;
  university: string | null;
  department: string | null;
  role: string;
  subscription_status: string;
  plan_name: string;
  created_at: string;
  is_disabled: boolean;
  has_override: boolean;
  override_details?: {
    courses?: number;
    topics_per_course?: number;
    ai_extractions?: number;
    trial_extension_days?: number;
  };
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    
    // Get profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get roles for all users
    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    // Get subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('user_id, status, plans(name)')
      .in('user_id', userIds);

    // Get admin overrides
    const { data: overrides } = await supabase
      .from('admin_overrides')
      .select('user_id, quota_overrides, trial_extension_days')
      .in('user_id', userIds);

    const formattedUsers = profiles.map((p: any) => {
      const userRole = roles?.find(r => r.user_id === p.user_id);
      const userSub = subscriptions?.find(s => s.user_id === p.user_id);
      const override = overrides?.find(o => o.user_id === p.user_id);
      
        const hasQuotaOverride = !!override?.quota_overrides && Object.keys((override.quota_overrides as any) || {}).length > 0;
        const hasTrialOverride = (override?.trial_extension_days || 0) > 0;

        return {
          id: p.id,
          user_id: p.user_id,
          email: p.email || "No Email",
          display_name: p.display_name,
          phone_number: p.phone_number,
          university: p.university,
          department: p.department,
          role: userRole?.role || "user",
          subscription_status: userSub?.status || "none",
          plan_name: hasQuotaOverride
            ? "Pro (Override)"
            : hasTrialOverride
              ? `Pro Trial (+${override?.trial_extension_days}d)`
              : ((userSub?.plans as any)?.name || "Free"),
          created_at: p.created_at,
          is_disabled: p.is_disabled || false,
          has_override: !!override,
          override_details: override?.quota_overrides as any,
        };
    });

    setUsers(formattedUsers);
    setLoading(false);
  }

  // Filter users by email, name, university, or department
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id.includes(search) ||
    (u.display_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.university?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.department?.toLowerCase() || '').includes(search.toLowerCase())
  );

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    if (newRole === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'admin' });
      
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: `User promoted to admin` });
        fetchUsers();
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: `User demoted to user` });
        fetchUsers();
      }
    }
  }

  async function toggleDisable(userId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_disabled: !currentStatus })
      .eq('user_id', userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${!currentStatus ? 'disabled' : 'enabled'}` });
      fetchUsers();
    }
  }

  async function quickGrantPro(user: User) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("admin_overrides")
        .upsert({
          user_id: user.user_id,
          quota_overrides: {
            courses: -1,
            topics_per_course: -1,
            ai_extractions: 1000,
          },
          notes: "Quick grant Pro from admin panel",
          created_by: currentUser.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;
      toast({ title: "Success", description: "Pro access granted" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  async function quickExtendTrial(user: User, days: number) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Get existing override
      const { data: existing } = await supabase
        .from("admin_overrides")
        .select("trial_extension_days")
        .eq("user_id", user.user_id)
        .maybeSingle();

      const newDays = (existing?.trial_extension_days || 0) + days;

      const { error } = await supabase
        .from("admin_overrides")
        .upsert({
          user_id: user.user_id,
          trial_extension_days: newDays,
          notes: `Trial extended by ${days} days`,
          created_by: currentUser.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;
      toast({ title: "Success", description: `Trial extended by ${days} days` });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  async function resetOverrides(user: User) {
    try {
      const { error } = await supabase
        .from("admin_overrides")
        .delete()
        .eq("user_id", user.user_id);

      if (error) throw error;
      toast({ title: "Success", description: "User reset to default plan" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  function openSubscriptionDialog(user: User) {
    setSelectedUser(user);
    setShowSubscriptionDialog(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <div className="flex w-1/3 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>University / Dept</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.display_name || 'No Name'}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      {user.phone_number ? (
                        <span>{user.phone_number}</span>
                      ) : (
                        <span className="text-muted-foreground">No phone</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium">{user.university || '—'}</span>
                      <span className="text-xs text-muted-foreground">{user.department || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                      {user.role === 'admin' ? (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.has_override ? 'default' : 'secondary'}>
                        {user.has_override && <Crown className="h-3 w-3 mr-1" />}
                        {user.plan_name}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.is_disabled ? 'destructive' : user.subscription_status === 'active' ? 'default' : 'outline'}
                    >
                      {user.is_disabled ? 'Disabled' : user.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserCog className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Subscription</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => quickGrantPro(user)}>
                            <Crown className="h-4 w-4 mr-2 text-amber-500" />
                            Grant Pro Access
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickExtendTrial(user, 7)}>
                            <Clock className="h-4 w-4 mr-2 text-blue-500" />
                            Add 7 Days Trial
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickExtendTrial(user, 30)}>
                            <Clock className="h-4 w-4 mr-2 text-blue-500" />
                            Add 30 Days Trial
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSubscriptionDialog(user)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Custom Settings...
                          </DropdownMenuItem>
                          {user.has_override && (
                            <DropdownMenuItem onClick={() => resetOverrides(user)} className="text-destructive">
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset to Free
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Account</DropdownMenuLabel>
                          
                          <DropdownMenuItem onClick={() => toggleRole(user.user_id, user.role)}>
                            {user.role === 'admin' ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2 text-orange-500" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2 text-green-500" />
                                Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => toggleDisable(user.user_id, user.is_disabled)}
                            className={user.is_disabled ? 'text-green-600' : 'text-destructive'}
                          >
                            {user.is_disabled ? 'Enable Account' : 'Disable Account'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminSubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
}