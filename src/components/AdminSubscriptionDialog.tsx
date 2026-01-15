import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface AdminSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    email: string;
    plan_name: string;
  } | null;
  onSuccess: () => void;
}

type OverrideAction = "grant_pro" | "grant_trial" | "custom_quotas" | "reset";

export default function AdminSubscriptionDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: AdminSubscriptionDialogProps) {
  const [action, setAction] = useState<OverrideAction>("grant_pro");
  const [trialDays, setTrialDays] = useState(14);
  const [courses, setCourses] = useState(-1);
  const [topicsPerCourse, setTopicsPerCourse] = useState(-1);
  const [creditBalance, setCreditBalance] = useState(1500);
  const [creditAllowance, setCreditAllowance] = useState(1500);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      if (action === "reset") {
        // Delete any existing override
        const { error } = await supabase
          .from("admin_overrides")
          .delete()
          .eq("user_id", user.user_id);

        if (error) throw error;
        toast({ title: "Success", description: "User reset to default plan" });
      } else {
        // Build override data
        let quotaOverrides: Record<string, number> | null = null;
        let trialExtension: number | null = null;

        if (action === "grant_pro") {
          quotaOverrides = {
            courses: -1,
            topics_per_course: -1,
            credit_balance: 1500,
            credit_allowance: 1500,
          };
        } else if (action === "grant_trial") {
          trialExtension = trialDays;
        } else if (action === "custom_quotas") {
          quotaOverrides = {
            courses: courses,
            topics_per_course: topicsPerCourse,
            credit_balance: creditBalance,
            credit_allowance: creditAllowance,
          };
        }

        // Upsert the override
        const { error } = await supabase
          .from("admin_overrides")
          .upsert({
            user_id: user.user_id,
            quota_overrides: quotaOverrides,
            trial_extension_days: trialExtension,
            notes: notes || null,
            created_by: currentUser.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id",
          });

        if (error) throw error;

        const actionMessages: Record<OverrideAction, string> = {
          grant_pro: "Pro access granted",
          grant_trial: `Trial extended by ${trialDays} days`,
          custom_quotas: "Custom quotas applied",
          reset: "User reset",
        };

        toast({ title: "Success", description: actionMessages[action] });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Subscription</DialogTitle>
          <DialogDescription>
            Manage subscription for <strong>{user.email}</strong>
            <br />
            Current plan: <strong>{user.plan_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as OverrideAction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grant_pro">Grant Pro Access</SelectItem>
                <SelectItem value="grant_trial">Extend Trial</SelectItem>
                <SelectItem value="custom_quotas">Set Custom Quotas</SelectItem>
                <SelectItem value="reset">Reset to Default</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === "grant_trial" && (
            <div className="space-y-2">
              <Label>Trial Extension (days)</Label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                min={1}
                max={365}
              />
            </div>
          )}

          {action === "custom_quotas" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Courses Limit (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={courses}
                  onChange={(e) => setCourses(parseInt(e.target.value))}
                  min={-1}
                />
              </div>
              <div className="space-y-2">
                <Label>Topics per Course (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={topicsPerCourse}
                  onChange={(e) => setTopicsPerCourse(parseInt(e.target.value))}
                  min={-1}
                />
              </div>
              <div className="space-y-2">
                <Label>AI Credits Balance</Label>
                <Input
                  type="number"
                  value={creditBalance}
                  onChange={(e) => setCreditBalance(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Credit Allowance</Label>
                <Input
                  type="number"
                  value={creditAllowance}
                  onChange={(e) => setCreditAllowance(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Admin Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for this change..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Apply Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
