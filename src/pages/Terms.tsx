import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
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

        <h1 className="text-3xl font-bold mb-8">{t('termsOfService')}</h1>
        
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last updated: January 2026'}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsAcceptance')}</h2>
            <p>
              {language === 'ar' 
                ? 'باستخدامك لمنصة StudyBudy، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام المنصة.'
                : 'By using StudyBudy, you agree to be bound by these terms and conditions. If you do not agree to any part of these terms, please do not use the platform.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsUserResponsibilities')}</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                {language === 'ar'
                  ? 'أنت مسؤول عن الحفاظ على سرية حسابك وكلمة المرور الخاصة بك.'
                  : 'You are responsible for maintaining the confidentiality of your account and password.'}
              </li>
              <li>
                {language === 'ar'
                  ? 'يجب أن تكون جميع المعلومات التي تقدمها دقيقة وحديثة.'
                  : 'All information you provide must be accurate and up to date.'}
              </li>
              <li>
                {language === 'ar'
                  ? 'يُحظر استخدام المنصة لأي أغراض غير قانونية أو غير مصرح بها.'
                  : 'Using the platform for any illegal or unauthorized purposes is prohibited.'}
              </li>
              <li>
                {language === 'ar'
                  ? 'أنت مسؤول عن جميع الأنشطة التي تحدث تحت حسابك.'
                  : 'You are responsible for all activities that occur under your account.'}
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsIntellectualProperty')}</h2>
            <p>
              {language === 'ar'
                ? 'جميع المحتويات والعلامات التجارية والملكية الفكرية على المنصة مملوكة لـ StudyBudy أو مرخصيها. لا يجوز نسخ أو تعديل أو توزيع أي محتوى دون إذن كتابي مسبق.'
                : 'All content, trademarks, and intellectual property on the platform are owned by StudyBudy or its licensors. No content may be copied, modified, or distributed without prior written permission.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsLimitations')}</h2>
            <p>
              {language === 'ar'
                ? 'يتم توفير المنصة "كما هي" دون أي ضمانات صريحة أو ضمنية. لا نضمن أن المنصة ستكون خالية من الأخطاء أو متاحة دون انقطاع. في حدود ما يسمح به القانون، لن نكون مسؤولين عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنصة.'
                : 'The platform is provided "as is" without any express or implied warranties. We do not guarantee that the platform will be error-free or available without interruption. To the extent permitted by law, we shall not be liable for any direct or indirect damages resulting from the use of the platform.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsSubscription')}</h2>
            <p>
              {language === 'ar'
                ? 'تتم معالجة المدفوعات بشكل آمن عبر Stripe. يتم تجديد الاشتراكات تلقائياً ما لم يتم إلغاؤها قبل تاريخ التجديد. يمكنك إلغاء اشتراكك في أي وقت من إعدادات حسابك.'
                : 'Payments are processed securely via Stripe. Subscriptions renew automatically unless cancelled before the renewal date. You can cancel your subscription at any time from your account settings.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsTermination')}</h2>
            <p>
              {language === 'ar'
                ? 'نحتفظ بالحق في تعليق أو إنهاء حسابك في أي وقت إذا انتهكت هذه الشروط. يمكنك حذف حسابك في أي وقت من إعدادات حسابك.'
                : 'We reserve the right to suspend or terminate your account at any time if you violate these terms. You may delete your account at any time from your account settings.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsChanges')}</h2>
            <p>
              {language === 'ar'
                ? 'قد نقوم بتحديث هذه الشروط من وقت لآخر. سيتم إخطارك بأي تغييرات جوهرية. استمرار استخدامك للمنصة بعد التغييرات يعني موافقتك على الشروط المحدثة.'
                : 'We may update these terms from time to time. You will be notified of any material changes. Continued use of the platform after changes constitutes acceptance of the updated terms.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('termsContact')}</h2>
            <p>
              {language === 'ar'
                ? 'إذا كان لديك أي أسئلة حول هذه الشروط، يرجى التواصل معنا عبر البريد الإلكتروني: support@studybudy.app'
                : 'If you have any questions about these terms, please contact us at: support@studybudy.app'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
