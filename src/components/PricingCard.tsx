import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, Zap, Phone } from "lucide-react";
import { STRIPE_PRICES, formatPrice, type BillingCycle } from "@/lib/stripe";
import { ContactUpgradeDialog } from "./ContactUpgradeDialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface PricingCardProps {
  currentPlan?: string;
  onUpgradeSuccess?: () => void;
}

export function PricingCard({ currentPlan = "free" }: PricingCardProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [showContactDialog, setShowContactDialog] = useState(false);
  const { t } = useLanguage();

  const monthlyPrice = STRIPE_PRICES.pro.monthly.amount / 100;
  const annualPrice = STRIPE_PRICES.pro.annual.amount / 100;
  const annualMonthlyEquivalent = annualPrice / 12;
  const savings = Math.round((1 - annualMonthlyEquivalent / monthlyPrice) * 100);

  const isPro = currentPlan === "pro";

  return (
    <div className="space-y-6">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={billingCycle === "monthly" ? "font-semibold" : "text-muted-foreground"}>
          {t('monthly')}
        </Label>
        <Switch
          id="billing-toggle"
          checked={billingCycle === "annual"}
          onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
        />
        <Label htmlFor="billing-toggle" className={billingCycle === "annual" ? "font-semibold" : "text-muted-foreground"}>
          {t('annual')}
          <Badge variant="secondary" className="ml-2 text-xs">
            {t('save')} {savings}%
          </Badge>
        </Label>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free Plan */}
        <Card className={currentPlan === "free" ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('freePlan')}
              {currentPlan === "free" && (
                <Badge variant="outline">{t('currentPlan')}</Badge>
              )}
            </CardTitle>
            <CardDescription>{t('freeDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">
              {formatPrice(0)}
              <span className="text-sm font-normal text-muted-foreground">/{t('month')}</span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('freeCourses')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('freeTopics')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('freeExtractions')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('basicScheduling')}
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              {currentPlan === "free" ? t('currentPlan') : t('downgrade')}
            </Button>
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card className={`relative ${isPro ? "border-primary" : "border-primary/50"}`}>
          {!isPro && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">
                <Sparkles className="w-3 h-3 mr-1" />
                {t('recommended')}
              </Badge>
            </div>
          )}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('proPlan')}
              {isPro && (
                <Badge variant="outline">{t('currentPlan')}</Badge>
              )}
            </CardTitle>
            <CardDescription>{t('proDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">
              {formatPrice(billingCycle === "monthly" ? monthlyPrice : annualMonthlyEquivalent)}
              <span className="text-sm font-normal text-muted-foreground">/{t('month')}</span>
              {billingCycle === "annual" && (
                <div className="text-sm font-normal text-muted-foreground">
                  {t('billedAnnually')} {formatPrice(annualPrice)}
                </div>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <strong>{t('unlimited')}</strong> {t('coursesLabel')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <strong>{t('unlimited')}</strong> {t('topicsPerCourse')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('proExtractions')}
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <strong>{t('aiSmartScheduling')}</strong>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('spacedRepetition')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('dependencyTracking')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {t('prioritySupport')}
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={() => setShowContactDialog(true)}
              disabled={isPro}
            >
              {isPro ? (
                t('currentPlan')
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  {t('upgradeToPro')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ContactUpgradeDialog 
        open={showContactDialog} 
        onOpenChange={setShowContactDialog} 
      />
    </div>
  );
}