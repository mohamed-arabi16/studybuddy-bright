import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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

        <h1 className="text-3xl font-bold mb-8">{t('privacyPolicy')}</h1>
        
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last updated: January 2026'}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyIntro')}</h2>
            <p>
              {language === 'ar'
                ? 'نحن في Zen Study نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك.'
                : 'At Zen Study, we respect your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and protect your information.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyDataCollection')}</h2>
            <p>{language === 'ar' ? 'نجمع الأنواع التالية من المعلومات:' : 'We collect the following types of information:'}</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>{language === 'ar' ? 'معلومات الحساب:' : 'Account Information:'}</strong>{' '}
                {language === 'ar'
                  ? 'البريد الإلكتروني، الاسم، كلمة المرور المشفرة'
                  : 'Email, name, encrypted password'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'بيانات الدراسة:' : 'Study Data:'}</strong>{' '}
                {language === 'ar'
                  ? 'المواد الدراسية، المواضيع، خطط الدراسة، تقدم الإكمال'
                  : 'Courses, topics, study plans, completion progress'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'الملفات المرفوعة:' : 'Uploaded Files:'}</strong>{' '}
                {language === 'ar'
                  ? 'ملفات PDF للمناهج الدراسية (تُستخدم لاستخراج المواضيع فقط)'
                  : 'Syllabus PDF files (used for topic extraction only)'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'بيانات الاستخدام:' : 'Usage Data:'}</strong>{' '}
                {language === 'ar'
                  ? 'جلسات البومودورو، إحصائيات الدراسة، تفاعلات المنصة'
                  : 'Pomodoro sessions, study statistics, platform interactions'}
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyDataUsage')}</h2>
            <p>{language === 'ar' ? 'نستخدم بياناتك لـ:' : 'We use your data to:'}</p>
            <ul className="list-disc list-inside space-y-2">
              <li>{language === 'ar' ? 'توفير وتحسين خدماتنا' : 'Provide and improve our services'}</li>
              <li>{language === 'ar' ? 'إنشاء خطط دراسية مخصصة' : 'Generate personalized study plans'}</li>
              <li>{language === 'ar' ? 'تتبع تقدمك الأكاديمي' : 'Track your academic progress'}</li>
              <li>{language === 'ar' ? 'معالجة المدفوعات بشكل آمن' : 'Process payments securely'}</li>
              <li>{language === 'ar' ? 'إرسال إشعارات مهمة حول حسابك' : 'Send important notifications about your account'}</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyThirdParties')}</h2>
            <p>{language === 'ar' ? 'نشارك البيانات مع الأطراف الثالثة التالية فقط:' : 'We share data with the following third parties only:'}</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Stripe:</strong>{' '}
                {language === 'ar'
                  ? 'لمعالجة المدفوعات بشكل آمن'
                  : 'For secure payment processing'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'خدمات الذكاء الاصطناعي:' : 'AI Services:'}</strong>{' '}
                {language === 'ar'
                  ? 'لاستخراج المواضيع من الملفات المرفوعة (البيانات مجهولة الهوية)'
                  : 'For extracting topics from uploaded files (data is anonymized)'}
              </li>
            </ul>
            <p>
              {language === 'ar'
                ? 'لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث.'
                : 'We do not sell or rent your personal data to any third party.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyDataRetention')}</h2>
            <p>
              {language === 'ar'
                ? 'نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف حسابك، يتم حذف جميع بياناتك الشخصية نهائياً خلال 30 يوماً.'
                : 'We retain your data as long as your account is active. When you delete your account, all your personal data is permanently deleted within 30 days.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyUserRights')}</h2>
            <p>{language === 'ar' ? 'لديك الحقوق التالية:' : 'You have the following rights:'}</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>{language === 'ar' ? 'الوصول:' : 'Access:'}</strong>{' '}
                {language === 'ar'
                  ? 'يمكنك طلب نسخة من بياناتك في أي وقت'
                  : 'You can request a copy of your data at any time'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'التصحيح:' : 'Correction:'}</strong>{' '}
                {language === 'ar'
                  ? 'يمكنك تحديث معلوماتك الشخصية من إعدادات حسابك'
                  : 'You can update your personal information from your account settings'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'الحذف:' : 'Deletion:'}</strong>{' '}
                {language === 'ar'
                  ? 'يمكنك حذف حسابك وجميع بياناتك من إعدادات حسابك'
                  : 'You can delete your account and all your data from your account settings'}
              </li>
              <li>
                <strong>{language === 'ar' ? 'التصدير:' : 'Export:'}</strong>{' '}
                {language === 'ar'
                  ? 'يمكنك تصدير بياناتك بتنسيق قابل للقراءة'
                  : 'You can export your data in a readable format'}
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacySecurity')}</h2>
            <p>
              {language === 'ar'
                ? 'نستخدم تدابير أمنية متقدمة لحماية بياناتك، بما في ذلك التشفير أثناء النقل والتخزين، والمصادقة الآمنة، والوصول المحدود للموظفين.'
                : 'We use advanced security measures to protect your data, including encryption in transit and at rest, secure authentication, and limited employee access.'}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('privacyContact')}</h2>
            <p>
              {language === 'ar'
                ? 'لأي استفسارات تتعلق بالخصوصية، يرجى التواصل معنا عبر: privacy@zenstudy.app'
                : 'For any privacy-related inquiries, please contact us at: privacy@zenstudy.app'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
