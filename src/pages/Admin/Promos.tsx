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
import { Gift, Plus, Copy, Trash2, Users, Calendar, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  trial_days: number;
  max_redemptions: number;
  current_redemptions: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

export default function AdminPromos() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTrialDays, setNewTrialDays] = useState(7);
  const [newMaxRedemptions, setNewMaxRedemptions] = useState(10);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const { t, dir, language } = useLanguage();

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  async function fetchPromoCodes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    } else if (data) {
      setPromoCodes(data);
    }
    setLoading(false);
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PRO-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(result);
  }

  async function createPromoCode() {
    if (!newCode.trim()) {
      toast({ title: t('error'), description: t('promoCodeRequired'), variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('notAuthenticated'));

      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: newCode.toUpperCase().trim(),
          description: newDescription.trim() || null,
          trial_days: newTrialDays,
          max_redemptions: newMaxRedemptions,
          expires_at: newExpiresAt || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({ title: t('successTitle'), description: t('promoCodeCreated') });
      setShowCreateDialog(false);
      resetForm();
      fetchPromoCodes();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('unknownError');
      toast({ title: t('error'), description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setNewCode("");
    setNewDescription("");
    setNewTrialDays(7);
    setNewMaxRedemptions(10);
    setNewExpiresAt("");
  }

  async function toggleActive(promo: PromoCode) {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !promo.is_active })
      .eq('id', promo.id);

    if (error) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t('successTitle'), description: promo.is_active ? t('promoDeactivated') : t('promoActivated') });
      fetchPromoCodes();
    }
  }

  async function deletePromo(promo: PromoCode) {
    if (!confirm(t('confirmDeletePromo'))) return;

    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', promo.id);

    if (error) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t('successTitle'), description: t('promoDeleted') });
      fetchPromoCodes();
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: t('copied'), description: code });
  }

  async function updateMaxRedemptions(promo: PromoCode, newMax: number) {
    const { error } = await supabase
      .from('promo_codes')
      .update({ max_redemptions: newMax })
      .eq('id', promo.id);

    if (error) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t('successTitle'), description: t('limitUpdated') });
      fetchPromoCodes();
    }
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('promoCodes')}</h1>
          <p className="text-muted-foreground">{t('promoCodesDesc')}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('createPromoCode')}
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-40 px-4 py-3">{t('code')}</TableHead>
              <TableHead className="w-48 px-4 py-3">{t('description')}</TableHead>
              <TableHead className="w-24 px-4 py-3">{t('trialDays')}</TableHead>
              <TableHead className="w-32 px-4 py-3">{t('redemptions')}</TableHead>
              <TableHead className="w-28 px-4 py-3">{t('expires')}</TableHead>
              <TableHead className="w-24 px-4 py-3">{t('status')}</TableHead>
              <TableHead className="w-36 px-4 py-3 text-end">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 ms-auto" /></TableCell>
                </TableRow>
              ))
            ) : promoCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {t('noPromoCodes')}
                </TableCell>
              </TableRow>
            ) : (
              promoCodes.map((promo) => (
                <TableRow key={promo.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {promo.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyCode(promo.code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                    {promo.description || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Clock className="h-3 w-3" />
                      {promo.trial_days} {t('daysLabel')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={promo.current_redemptions >= promo.max_redemptions ? 'destructive' : 'outline'}
                        className="flex items-center gap-1"
                      >
                        <Users className="h-3 w-3" />
                        {promo.current_redemptions}/{promo.max_redemptions}
                      </Badge>
                      <Input
                        type="number"
                        className="w-16 h-7 text-xs"
                        value={promo.max_redemptions}
                        min={promo.current_redemptions}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= promo.current_redemptions) {
                            updateMaxRedemptions(promo, val);
                          }
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {promo.expires_at ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(promo.expires_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                      {promo.is_active ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={promo.is_active}
                        onCheckedChange={() => toggleActive(promo)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deletePromo(promo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('createPromoCode')}</DialogTitle>
            <DialogDescription>
              {t('createPromoCodeDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('promoCode')}</Label>
              <div className="flex gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="PRO-XXXXXX"
                  className="font-mono"
                />
                <Button variant="outline" onClick={generateRandomCode}>
                  {t('generate')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description')} ({t('optional')})</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('promoDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('trialDays')}</Label>
                <Input
                  type="number"
                  value={newTrialDays}
                  onChange={(e) => setNewTrialDays(parseInt(e.target.value) || 7)}
                  min={1}
                  max={365}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('maxRedemptions')}</Label>
                <Input
                  type="number"
                  value={newMaxRedemptions}
                  onChange={(e) => setNewMaxRedemptions(parseInt(e.target.value) || 10)}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('expirationDate')} ({t('optional')})</Label>
              <Input
                type="date"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              {t('cancel')}
            </Button>
            <Button onClick={createPromoCode} disabled={creating || !newCode.trim()}>
              {creating ? t('creating') : t('createPromoCode')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
