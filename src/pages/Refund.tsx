import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Refund() {
  const { t, dir, language } = useLanguage();

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="container max-w-3xl py-12 px-4">
        <Link to="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('backToHome')}
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">{t('refundTitle')}</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last updated: January 2026'}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('refundPolicy')}</h2>
            <p>{t('refundIntro')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsSubscription')}</h2>
            <p>{t('refundTerms')}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsContact')}</h2>
            <p>{t('refundContact')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
