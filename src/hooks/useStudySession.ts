import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useStudySession() {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load or create session on mount
  useEffect(() => {
    const initSession = async () => {
      // Check auth state first
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Authenticated flow
        const { data, error } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data && !error) {
          setSessionCode(data.session_code);
          setSessionId(data.id);
          setCompletedTasks(data.completed_tasks || []);
        } else {
          // No session found for user, create one
          await createNewSession(user.id);
        }
      } else {
        // Guest flow
        const urlParams = new URLSearchParams(window.location.search);
        const urlCode = urlParams.get('session');
        const storedCode = localStorage.getItem('study-session-code');
        const codeToUse = urlCode || storedCode;

        if (codeToUse) {
          const { data, error } = await supabase
            .from('study_sessions')
            .select('*')
            .eq('session_code', codeToUse)
            .maybeSingle();

          if (data && !error) {
            setSessionCode(data.session_code);
            setSessionId(data.id);
            setCompletedTasks(data.completed_tasks || []);
            localStorage.setItem('study-session-code', data.session_code);

            if (!urlCode && storedCode) {
              window.history.replaceState({}, '', `?session=${data.session_code}`);
            }
          } else {
            await createNewSession();
          }
        } else {
          await createNewSession();
        }
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  const createNewSession = async (userId?: string) => {
    const newCode = generateSessionCode();
    
    const payload: any = {
      session_code: newCode,
      completed_tasks: []
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await supabase
      .from('study_sessions')
      .insert(payload)
      .select()
      .single();
    
    if (data && !error) {
      setSessionCode(data.session_code);
      setSessionId(data.id);
      setCompletedTasks([]);
      if (!userId) {
        localStorage.setItem('study-session-code', data.session_code);
        window.history.replaceState({}, '', `?session=${data.session_code}`);
      }
    } else {
      console.error('Failed to create session:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في إنشاء جلسة جديدة',
        variant: 'destructive',
      });
    }
  };

  const syncToDatabase = useCallback(async (tasks: string[]) => {
    if (!sessionId) {
      console.log('No sessionId, skipping sync');
      return;
    }
    
    setIsSyncing(true);
    console.log('Syncing tasks to database:', { sessionId, tasks });
    
    const { data, error } = await supabase
      .from('study_sessions')
      .update({ completed_tasks: tasks })
      .eq('id', sessionId)
      .select();
    
    if (error) {
      console.error('Failed to sync:', error);
      toast({
        title: 'خطأ في الحفظ',
        description: 'سنحاول مرة أخرى',
        variant: 'destructive',
      });
    } else {
      console.log('Sync successful:', data);
    }
    
    setIsSyncing(false);
  }, [sessionId, toast]);

  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks(prev => {
      const newTasks = prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId];
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        syncToDatabase(newTasks);
      }, 500);
      
      return newTasks;
    });
  }, [syncToDatabase]);

  const getShareableLink = useCallback(() => {
    if (!sessionCode) return '';
    return `${window.location.origin}?session=${sessionCode}`;
  }, [sessionCode]);

  const copyShareableLink = useCallback(async () => {
    const link = getShareableLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'تم النسخ!',
        description: 'يمكنك مشاركة الرابط مع أي جهاز',
      });
    }
  }, [getShareableLink, toast]);

  return {
    sessionCode,
    completedTasks,
    isLoading,
    isSyncing,
    toggleTask,
    getShareableLink,
    copyShareableLink,
  };
}
