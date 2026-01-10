import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Infinity, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Plan = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: {
    courses: number;
    topics_per_course: number;
    ai_extractions: number;
  };
  features: string[];
  is_active: boolean;
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('price_monthly', { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setPlans(data.map(p => ({
        id: p.id,
        name: p.name,
        price_monthly: p.price_monthly ?? 0,
        price_yearly: p.price_yearly ?? 0,
        limits: (p.limits as any) || { courses: 0, topics_per_course: 0, ai_extractions: 0 },
        features: (p.features as string[]) || [],
        is_active: p.is_active ?? true,
      })));
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!editingPlan) return;
    
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          name: editingPlan.name,
          price_monthly: editingPlan.price_monthly,
          price_yearly: editingPlan.price_yearly,
          limits: editingPlan.limits,
          features: editingPlan.features,
        })
        .eq('id', editingPlan.id);

      if (error) throw error;
      
      toast({ title: "Success", description: "Plan updated" });
      setShowEditDialog(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  function startEditing(plan: Plan) {
    setEditingPlan({ ...plan });
    setShowEditDialog(true);
  }

  function formatLimit(value: number) {
    return value === -1 ? <Infinity className="h-4 w-4 inline" /> : value;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <Badge variant="outline" className="text-muted-foreground">
          {plans.length} plans configured
        </Badge>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No plans configured. Plans will be created automatically when the app is set up.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.name === 'Pro' ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {plan.name === 'Pro' && <Crown className="h-5 w-5 text-amber-500" />}
                    {plan.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => startEditing(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  {plan.price_monthly === 0 ? 'Free forever' : `$${plan.price_monthly}/month`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                  {plan.price_monthly > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Courses</span>
                    <span className="font-medium">{formatLimit(plan.limits.courses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Topics/Course</span>
                    <span className="font-medium">{formatLimit(plan.limits.topics_per_course)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Extractions</span>
                    <span className="font-medium">{formatLimit(plan.limits.ai_extractions)}/mo</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name} Plan</DialogTitle>
            <DialogDescription>
              Update plan settings and limits
            </DialogDescription>
          </DialogHeader>
          
          {editingPlan && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price ($)</Label>
                  <Input
                    type="number"
                    value={editingPlan.price_monthly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Yearly Price ($)</Label>
                <Input
                  type="number"
                  value={editingPlan.price_yearly}
                  onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-base">Limits (-1 = unlimited)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Courses</Label>
                    <Input
                      type="number"
                      value={editingPlan.limits.courses}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, courses: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Topics/Course</Label>
                    <Input
                      type="number"
                      value={editingPlan.limits.topics_per_course}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, topics_per_course: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">AI Extractions</Label>
                    <Input
                      type="number"
                      value={editingPlan.limits.ai_extractions}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, ai_extractions: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}