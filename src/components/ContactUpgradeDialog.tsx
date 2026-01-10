import { useState } from 'react';
import { Phone, Copy, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface ContactUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTACT_NUMBER = '+905380130948';

export function ContactUpgradeDialog({ open, onOpenChange }: ContactUpgradeDialogProps) {
  const { t, dir } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_NUMBER);
      setCopied(true);
      toast.success(t('numberCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            {t('contactToUpgrade')}
          </DialogTitle>
          <DialogDescription>
            {t('upgradeMessage')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 w-full justify-center">
            <Phone className="w-5 h-5 text-primary" />
            <span className="text-xl font-bold tracking-wider" dir="ltr">
              {CONTACT_NUMBER}
            </span>
          </div>
          
          <Button 
            onClick={handleCopy} 
            variant="outline" 
            className="w-full gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                {t('copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('copyNumber')}
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            <X className="w-4 h-4 me-2" />
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}