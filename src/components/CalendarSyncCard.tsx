import { useState, useEffect } from 'react';
import { Calendar, Check, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface CalendarConnection {
  connected: boolean;
  autoSync: boolean;
  lastSync?: string;
}

export function CalendarSyncCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchConnectionStatus();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const calendarCallback = urlParams.get('calendar_callback');
    
    if (code && calendarCallback === 'true') {
      handleOAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });
      
      if (error) throw error;
      
      setConnection(data);
    } catch (error) {
      console.error('Failed to fetch calendar status:', error);
      setConnection({ connected: false, autoSync: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      const redirectUri = `${window.location.origin}/settings?calendar_callback=true`;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'auth-url', redirectUri },
      });
      
      if (error) throw error;
      
      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch (error) {
      console.error('Connect error:', error);
      toast({
        title: t('error'),
        description: 'Failed to start connection',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      setConnecting(true);
      
      const redirectUri = `${window.location.origin}/settings?calendar_callback=true`;
      
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'exchange', code, redirectUri },
      });
      
      if (error) throw error;
      
      toast({
        title: t('calendarConnected'),
        description: t('syncSuccess'),
      });
      
      await fetchConnectionStatus();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast({
        title: t('error'),
        description: 'Failed to connect calendar',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('sync-calendar');
      
      if (error) throw error;
      
      toast({
        title: t('syncSuccess'),
        description: t('eventsCreated').replace('{count}', String(data.eventsCreated)),
      });
      
      await fetchConnectionStatus();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: t('error'),
        description: 'Failed to sync calendar',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      
      const { error } = await supabase.functions.invoke('disconnect-calendar');
      
      if (error) throw error;
      
      toast({
        title: t('disconnectCalendar'),
        description: 'Calendar disconnected successfully',
      });
      
      setConnection({ connected: false, autoSync: false });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: t('error'),
        description: 'Failed to disconnect calendar',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ auto_sync: enabled })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
      
      if (error) throw error;
      
      setConnection(prev => prev ? { ...prev, autoSync: enabled } : null);
      
      toast({
        title: t('settingsSaved'),
        description: enabled ? t('autoSync') + ' enabled' : t('autoSync') + ' disabled',
      });
    } catch (error) {
      console.error('Auto-sync toggle error:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle>{t('calendarSync')}</CardTitle>
          </div>
          {connection?.connected && (
            <Badge variant="secondary" className="gap-1">
              <Check className="w-3 h-3" />
              {t('calendarConnected')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {connection?.connected 
            ? t('autoSyncDesc')
            : t('connectCalendarDesc')
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection?.connected ? (
          <>
            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">{t('autoSync')}</Label>
                <p className="text-xs text-muted-foreground">{t('autoSyncDesc')}</p>
              </div>
              <Switch
                id="auto-sync"
                checked={connection.autoSync}
                onCheckedChange={handleAutoSyncToggle}
              />
            </div>

            {/* Last sync info */}
            {connection.lastSync && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(connection.lastSync).toLocaleString()}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 me-2" />
                )}
                {syncing ? t('syncing') : t('syncNow')}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 me-2" />
                )}
                {t('disconnectCalendar')}
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
            {connecting ? (
              <Loader2 className="w-4 h-4 me-2 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4 me-2" />
            )}
            {t('connectGoogleCalendar')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
