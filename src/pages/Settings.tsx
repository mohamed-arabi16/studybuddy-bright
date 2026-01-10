import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Clock, CreditCard, LogOut, Loader2, ExternalLink, Phone, Building, GraduationCap, Trash2, Download, AlertTriangle, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PricingCard } from '@/components/PricingCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';

export default function Settings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, dir } = useLanguage();
  
  // Use subscription hook for accurate plan status (includes admin overrides)
  const { planName, isPro, isLoading: subLoading, billingCycle, subscriptionEnd, refresh: refreshSubscription } = useSubscription();
  
  const [profile, setProfile] = useState({
    full_name: '',
    display_name: '',
    email: '',
    daily_study_hours: 3,
    study_days_per_week: 6,
    language: 'ar',
    phone_number: '',
    department: '',
    university: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    
    // Handle checkout result
    const checkoutResult = searchParams.get('checkout');
    if (checkoutResult === 'success') {
      toast({
        title: t('welcomeToPro'),
        description: t('subscriptionActive'),
      });
      // Refresh subscription status
      setTimeout(() => refreshSubscription(), 2000);
    } else if (checkoutResult === 'cancelled') {
      toast({
        title: t('checkoutCancelled'),
        description: t('upgradeAnytime'),
      });
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          display_name: data.display_name || '',
          email: data.email || user.email || '',
          daily_study_hours: data.daily_study_hours || 3,
          study_days_per_week: data.study_days_per_week || 6,
          language: data.language || 'ar',
          phone_number: data.phone_number || '',
          department: data.department || '',
          university: data.university || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');
      
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: t('error'),
        description: t('portalError'),
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          display_name: profile.display_name || profile.full_name,
          daily_study_hours: profile.daily_study_hours,
          study_days_per_week: profile.study_days_per_week,
          language: profile.language,
          phone_number: profile.phone_number,
          department: profile.department,
          university: profile.university,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('settingsSaved'),
        description: t('preferencesUpdated'),
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: t('saveFailed'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const { data, error } = await supabase.functions.invoke('export-user-data');
      
      if (error) throw error;
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zen-study-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('exportSuccess'),
        description: t('exportSuccessDesc'),
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: t('error'),
        description: t('exportFailed'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    
    try {
      setDeleting(true);
      
      // First verify password by re-signing in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('User not found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (signInError) {
        toast({
          title: t('error'),
          description: t('incorrectPassword'),
          variant: 'destructive',
        });
        return;
      }

      // Call delete account edge function
      const { error } = await supabase.functions.invoke('delete-account');
      
      if (error) throw error;

      toast({
        title: t('accountDeleted'),
        description: t('accountDeletedDesc'),
      });

      // Sign out and redirect
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t('error'),
        description: t('deleteAccountFailed'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setResetLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`
      });
      
      if (error) throw error;
      
      toast({
        title: t('passwordResetSent'),
        description: t('checkEmailForReset'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use subscription hook's planName (includes admin overrides)
  const currentPlan = isPro ? 'pro' : 'free';

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
        <p className="text-muted-foreground">
          {t('manageAccount')}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            {t('profile')}
          </TabsTrigger>
          <TabsTrigger value="study" className="gap-2">
            <Clock className="w-4 h-4" />
            {t('studyPreferences')}
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="w-4 h-4" />
            {t('subscription')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profileInfo')}</CardTitle>
              <CardDescription>
                {t('updateDetails')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('fullName')}</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  placeholder={t('fullNamePlaceholder')}
                  dir="auto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">{t('displayName')}</Label>
                <Input
                  id="display_name"
                  value={profile.display_name}
                  onChange={(e) => setProfile(p => ({ ...p, display_name: e.target.value }))}
                  placeholder={t('yourName')}
                  dir="auto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  {t('emailCannotChange')}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="university" className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    {t('university')}
                  </Label>
                  <Input
                    id="university"
                    value={profile.university}
                    onChange={(e) => setProfile(p => ({ ...p, university: e.target.value }))}
                    placeholder={t('universityPlaceholder')}
                    dir="auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    {t('department')}
                  </Label>
                  <Input
                    id="department"
                    value={profile.department}
                    onChange={(e) => setProfile(p => ({ ...p, department: e.target.value }))}
                    placeholder={t('departmentPlaceholder')}
                    dir="auto"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {t('phoneNumber')}
                </Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={profile.phone_number}
                  onChange={(e) => setProfile(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder={t('phonePlaceholder')}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  {t('phoneHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{t('language')}</Label>
                <Select 
                  value={profile.language} 
                  onValueChange={(v) => setProfile(p => ({ ...p, language: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية (Arabic)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {t('saveChanges')}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
              <CardDescription>{t('dangerZoneDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Reset */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">{t('resetPasswordTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('resetPasswordDesc')}</p>
                </div>
                <Button variant="outline" onClick={handlePasswordReset} disabled={resetLoading}>
                  {resetLoading ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 me-2" />
                  )}
                  {t('sendResetLink')}
                </Button>
              </div>

              {/* Export Data */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">{t('exportData')}</p>
                  <p className="text-sm text-muted-foreground">{t('exportDataDesc')}</p>
                </div>
                <Button variant="outline" onClick={handleExportData} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 me-2" />
                  )}
                  {t('export')}
                </Button>
              </div>

              {/* Delete Account */}
              <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div className="space-y-1">
                  <p className="font-medium text-destructive">{t('deleteAccount')}</p>
                  <p className="text-sm text-muted-foreground">{t('deleteAccountDesc')}</p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4 me-2" />
                  {t('delete')}
                </Button>
              </div>

              {/* Sign Out */}
              <div className="pt-2 border-t">
                <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
                  <LogOut className="w-4 h-4 me-2" />
                  {t('signOut')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  {t('confirmDeleteAccount')}
                </CardTitle>
                <CardDescription>{t('deleteAccountWarning')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm-password">{t('enterPasswordToConfirm')}</Label>
                  <Input
                    id="delete-confirm-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t('password')}
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deletePassword}
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 me-2" />
                    )}
                    {t('permanentlyDelete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="study" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('studyPreferences')}</CardTitle>
              <CardDescription>
                {t('customizeStudyPlan')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="daily_hours">{t('dailyStudyHours')}</Label>
                <Select 
                  value={String(profile.daily_study_hours)} 
                  onValueChange={(v) => setProfile(p => ({ ...p, daily_study_hours: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                      <SelectItem key={h} value={String(h)}>{h} {t('hoursLabel')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('howManyHours')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="study_days">{t('studyDaysPerWeek')}</Label>
                <Select 
                  value={String(profile.study_days_per_week)} 
                  onValueChange={(v) => setProfile(p => ({ ...p, study_days_per_week: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7].map(d => (
                      <SelectItem key={d} value={String(d)}>{d} {t('daysLabel')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {t('savePreferences')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          {subLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Current subscription status */}
              {isPro && (
                <Card className="border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {planName}
                          <Badge>{t('active')}</Badge>
                        </CardTitle>
                        <CardDescription>
                          {billingCycle === 'annual' ? t('annual') : t('monthly')} {t('billing')}
                          {subscriptionEnd && (
                            <> • {t('renews')} {new Date(subscriptionEnd).toLocaleDateString()}</>
                          )}
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={openCustomerPortal}
                        disabled={portalLoading}
                      >
                        {portalLoading ? (
                          <Loader2 className="w-4 h-4 me-2 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4 me-2" />
                        )}
                        {t('manageSubscription')}
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Pricing cards */}
              <PricingCard 
                currentPlan={currentPlan} 
                onUpgradeSuccess={() => {
                  toast({
                    title: t('checkoutStarted'),
                    description: t('completePayment'),
                  });
                }}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
