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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, Plus, XCircle, AlertCircle, CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type TrialUser = {
  user_id: string;
  email: string;
  trial_end: string;
  trial_extension_days: number;
  days_remaining: number;
};

export default function AdminTrials() {
  const [users, setUsers] = useState<TrialUser[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [grantSearch, setGrantSearch] = useState("");
  const [selectedGrantUser, setSelectedGrantUser] = useState<string | null>(null);
  const [grantDays, setGrantDays] = useState(14);

  useEffect(() => {
    fetchTrials();
    fetchAllUsers();
  }, []);

  async function fetchAllUsers() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email');
    
    if (profiles) {
      setAllUsers(profiles);
    }
  }

  async function fetchTrials() {
    setLoading(true);

    // Get subscriptions that are trialing
    const { data: subData, error } = await supabase
      .from('subscriptions')
      .select('user_id, status, trial_end')
      .eq('status', 'trialing');

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!subData || subData.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = subData.map(s => s.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('user_id', userIds);

    const { data: overrides } = await supabase
      .from('admin_overrides')
      .select('user_id, trial_extension_days')
      .in('user_id', userIds);

    const now = new Date();
    const mapped = subData.map((s: any) => {
      const profile = profiles?.find(p => p.user_id === s.user_id);
      const override = overrides?.find(o => o.user_id === s.user_id);
      const trialEnd = new Date(s.trial_end);
      const extensionDays = override?.trial_extension_days || 0;
      const adjustedEnd = new Date(trialEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((adjustedEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        user_id: s.user_id,
        email: profile?.email || 'Unknown',
        trial_end: s.trial_end,
        trial_extension_days: extensionDays,
        days_remaining: daysRemaining,
      };
    });
    
    setUsers(mapped.sort((a, b) => a.days_remaining - b.days_remaining));
    setLoading(false);
  }

  const filteredUsers = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  async function extendTrial(userId: string, days: number) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from('admin_overrides')
        .select('trial_extension_days')
        .eq('user_id', userId)
        .maybeSingle();

      const newDays = (existing?.trial_extension_days || 0) + days;

      const { error } = await supabase
        .from('admin_overrides')
        .upsert({
          user_id: userId,
          trial_extension_days: newDays,
          created_by: currentUser.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({ title: "Success", description: `Trial extended by ${days} days` });
      fetchTrials();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function endTrialNow(userId: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', trial_end: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Trial ended." });
      fetchTrials();
    }
  }

  async function grantTrial() {
    if (!selectedGrantUser) return;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Create or update subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + grantDays);

      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: selectedGrantUser,
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: trialEnd.toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (subError) throw subError;

      toast({ title: "Success", description: `Trial granted for ${grantDays} days` });
      setShowGrantDialog(false);
      setSelectedGrantUser(null);
      fetchTrials();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const grantFilteredUsers = allUsers.filter(u =>
    (u.email || "").toLowerCase().includes(grantSearch.toLowerCase()) &&
    !users.some(tu => tu.user_id === u.user_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Active Trials</h1>
        <Button onClick={() => setShowGrantDialog(true)}>
          <CalendarPlus className="h-4 w-4 mr-2" />
          Grant Trial
        </Button>
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
        <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-60 px-4 py-3">User</TableHead>
              <TableHead className="w-36 px-4 py-3">Original End Date</TableHead>
              <TableHead className="w-32 px-4 py-3">Extensions</TableHead>
              <TableHead className="w-32 px-4 py-3">Days Remaining</TableHead>
              <TableHead className="w-60 px-4 py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No active trials found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.user_id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <span className="font-medium truncate block max-w-[230px]" dir="auto" title={user.email}>
                      {user.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {new Date(user.trial_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {user.trial_extension_days > 0 ? (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit whitespace-nowrap">
                        <Plus className="h-3 w-3" />
                        {user.trial_extension_days} days
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge 
                      variant={user.days_remaining <= 3 ? 'destructive' : user.days_remaining <= 7 ? 'secondary' : 'outline'}
                      className="flex items-center gap-1 w-fit whitespace-nowrap"
                    >
                      <Clock className="h-3 w-3" />
                      {user.days_remaining} days
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => extendTrial(user.user_id, 7)}>
                        +7 Days
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => extendTrial(user.user_id, 30)}>
                        +30 Days
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => endTrialNow(user.user_id)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        End
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Grant Trial</DialogTitle>
            <DialogDescription>
              Start a trial for a user who doesn't have one
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search User</Label>
              <Input
                placeholder="Search by email..."
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
              />
            </div>

            {grantSearch && (
              <div className="border rounded-lg max-h-40 overflow-auto">
                {grantFilteredUsers.slice(0, 10).map(user => (
                  <button
                    key={user.user_id}
                    className={`w-full px-3 py-2 text-left hover:bg-muted transition-colors ${
                      selectedGrantUser === user.user_id ? 'bg-primary/10 text-primary' : ''
                    }`}
                    onClick={() => setSelectedGrantUser(user.user_id)}
                  >
                    {user.email}
                  </button>
                ))}
                {grantFilteredUsers.length === 0 && (
                  <div className="px-3 py-2 text-muted-foreground text-sm">
                    No users found (or all have trials)
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Trial Duration (days)</Label>
              <Input
                type="number"
                value={grantDays}
                onChange={(e) => setGrantDays(parseInt(e.target.value) || 14)}
                min={1}
                max={365}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              Cancel
            </Button>
            <Button onClick={grantTrial} disabled={!selectedGrantUser}>
              Grant Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}