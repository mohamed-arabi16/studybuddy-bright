import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Gift, Loader2, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PromoCodeRedemptionProps {
  onSuccess?: () => void;
}

export function PromoCodeRedemption({ onSuccess }: PromoCodeRedemptionProps) {
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  async function handleRedeem() {
    if (!code.trim()) {
      toast({
        title: t('error'),
        description: t('promoCodeRequired'),
        variant: "destructive",
      });
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc('redeem_promo_code', {
        p_code: code.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string; trial_days?: number };

      if (!result.success) {
        toast({
          title: t('error'),
          description: result.error || t('unknownError'),
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
      toast({
        title: t('promoRedeemed'),
        description: result.message || t('promoTrialGranted').replace('{days}', String(result.trial_days || 7)),
      });

      setCode("");
      onSuccess?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('unknownError');
      toast({
        title: t('error'),
        description: message,
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  }

  if (success) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3 text-green-500">
            <CheckCircle className="h-6 w-6" />
            <span className="font-medium">{t('promoRedeemed')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir={dir}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-primary" />
          {t('havePromoCode')}
        </CardTitle>
        <CardDescription>
          {t('enterPromoCode')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('promoCodePlaceholder')}
            className="font-mono flex-1"
            disabled={redeeming}
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRedeem();
            }}
          />
          <Button onClick={handleRedeem} disabled={redeeming || !code.trim()}>
            {redeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('redeem')
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
