import { Copy, Link, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

interface SessionBannerProps {
  sessionCode: string | null;
  isSyncing: boolean;
  onCopyLink: () => void;
}

export function SessionBanner({ sessionCode, isSyncing, onCopyLink }: SessionBannerProps) {
  if (!sessionCode) return null;

  return (
    <GlassCard className="p-4 mb-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Link className="w-5 h-5 text-primary" />
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">كود الجلسة</p>
            <p className="font-mono text-lg font-semibold text-foreground tracking-wider">
              {sessionCode}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isSyncing ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري الحفظ...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>محفوظ</span>
            </div>
          )}
          
          <Button 
            onClick={onCopyLink}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            نسخ الرابط
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
