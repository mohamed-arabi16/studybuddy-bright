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
import { Crown, Clock, Settings, RotateCcw, Search, UserCog, Shield, ShieldOff } from "lucide-react";
import AdminSubscriptionDialog from "@/components/AdminSubscriptionDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t, dir, language } = useLanguage();

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
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('users')}</h1>
        <div className="flex w-full sm:w-1/3 gap-2">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder={t('searchByEmail')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={dir === 'rtl' ? 'pr-9' : 'pl-9'}
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-56 px-4 py-3 text-sm text-gray-400">{t('user')}</TableHead>
              <TableHead className="w-32 px-4 py-3 text-sm text-gray-400">{t('contact')}</TableHead>
              <TableHead className="w-44 px-4 py-3 text-sm text-gray-400">{t('universityDept')}</TableHead>
              <TableHead className="w-20 px-4 py-3 text-sm text-gray-400">{t('role')}</TableHead>
              <TableHead className="w-32 px-4 py-3 text-sm text-gray-400">{t('plan')}</TableHead>
              <TableHead className="w-24 px-4 py-3 text-sm text-gray-400">{t('status')}</TableHead>
              <TableHead className="w-28 px-4 py-3 text-sm text-gray-400">{t('joined')}</TableHead>
              <TableHead className="w-36 px-4 py-3 text-end text-sm text-gray-400">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-white/5">
                  <TableCell className="py-4"><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-8 w-36" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-4 w-32 ms-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                  {t('noUsersFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30 border-b border-white/5">
                  <TableCell className="px-4 py-4">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate max-w-[200px]" title={user.display_name || t('noName')}>
                        {user.display_name || t('noName')}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={user.email}>
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex flex-col text-sm">
                      {user.phone_number ? (
                        <span dir="ltr" className="truncate max-w-[120px]">{user.phone_number}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex flex-col text-sm min-w-0 text-right">
                      <span dir="ltr" className="font-medium truncate max-w-[160px]" title={user.university || ''}>
                        {user.university || '—'}
                      </span>
                      <span dir="ltr" className="text-xs text-muted-foreground truncate max-w-[160px]" title={user.department || ''}>
                        {user.department || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className="whitespace-nowrap">
                      {user.role === 'admin' ? (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" /> {language === 'ar' ? 'أدمن' : 'Admin'}
                        </span>
                      ) : (language === 'ar' ? 'مستخدم' : 'User')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {user.plan_name === 'Free' || !user.plan_name ? (
                        <Badge variant="secondary" className="whitespace-nowrap text-gray-400">
                          {language === 'ar' ? 'غ/م' : 'N/A'}
                        </Badge>
                      ) : (
                        <Badge variant={user.has_override ? 'default' : 'secondary'} className="whitespace-nowrap">
                          {user.has_override && <Crown className={`h-3 w-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />}
                          {user.plan_name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {user.is_disabled ? (
                      <Badge variant="destructive" className="whitespace-nowrap">
                        {t('disabled')}
                      </Badge>
                    ) : user.subscription_status === 'none' || !user.subscription_status ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge 
                        variant={user.subscription_status === 'active' ? 'default' : 'outline'}
                        className="whitespace-nowrap"
                      >
                        {user.subscription_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm px-4 py-4 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </TableCell>
                  <TableCell className="text-end px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserCog className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                            {t('manage')}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t('subscriptionLabel')}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => quickGrantPro(user)}>
                            <Crown className={`h-4 w-4 text-amber-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                            {t('grantProAccess')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickExtendTrial(user, 7)}>
                            <Clock className={`h-4 w-4 text-blue-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                            {t('add7DaysTrial')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickExtendTrial(user, 30)}>
                            <Clock className={`h-4 w-4 text-blue-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                            {t('add30DaysTrial')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSubscriptionDialog(user)}>
                            <Settings className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                            {t('customSettings')}
                          </DropdownMenuItem>
                          {user.has_override && (
                            <DropdownMenuItem onClick={() => resetOverrides(user)} className="text-destructive">
                              <RotateCcw className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                              {t('resetToFree')}
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>{t('account')}</DropdownMenuLabel>
                          
                          <DropdownMenuItem onClick={() => toggleRole(user.user_id, user.role)}>
                            {user.role === 'admin' ? (
                              <>
                                <ShieldOff className={`h-4 w-4 text-orange-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                {t('removeAdmin')}
                              </>
                            ) : (
                              <>
                                <Shield className={`h-4 w-4 text-green-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                {t('makeAdmin')}
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => toggleDisable(user.user_id, user.is_disabled)}
                            className={user.is_disabled ? 'text-green-600' : 'text-destructive'}
                          >
                            {user.is_disabled ? t('enableAccount') : t('disableAccount')}
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