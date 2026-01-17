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
            {t("backToHome")}
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">{t("refundTitle")}</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground">
            {language === "ar" ? "آخر تحديث: يناير 2026" : "Last updated: January 2026"}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1) {t("refundOverview")}</h2>
            <p>
              {language === "ar"
                ? "StudyBuddy هي خدمة اشتراك رقمية تقدم ميزات مدعومة بالذكاء الاصطناعي (بما في ذلك استخراج المنهج، وإنشاء خطط الدراسة، وتحليل الاختبارات السابقة، وإنشاء الاختبارات القصيرة، وتحليل المواضيع). نحن نقدم استرداداً للأموال بموجب شروط محدودة لتمكين المستخدمين الجدد من تقييم الخدمة دون السماح بإساءة الاستخدام."
                : "StudyBuddy is a digital subscription that provides AI-powered features (including syllabus extraction, study plan generation, past exam analysis, quiz generation, and topic analysis). We offer refunds under limited conditions so new users can evaluate the service without enabling abuse."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2) {t("refundWindow")}</h2>
            <p>
              {language === "ar"
                ? 'يجب تقديم طلبات الاسترداد خلال 7 أيام تقويمية من تاريخ الاشتراك الأولي في باقة Pro ("فترة الاسترداد").'
                : "Refund requests must be submitted within 7 calendar days of the initial Pro subscription charge (the “Refund Window”)."}
            </p>
            <p>
              {language === "ar"
                ? "ينطبق الاسترداد فقط على فترة الاشتراك المدفوعة الأولى لذلك المستخدم."
                : "Refunds apply only to the first paid subscription period for that user."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3) {t("refundEligibility")}</h2>
            <p>{language === "ar" ? "أنت مؤهل لاسترداد الأموال فقط إذا:" : "You are eligible for a refund only if:"}</p>
            <ul className="list-decimal list-inside space-y-2">
              <li>
                {language === "ar"
                  ? "تم تقديم الطلب خلال فترة الاسترداد؛"
                  : "The request is made within the Refund Window;"}
              </li>
              <li>
                {language === "ar"
                  ? "هذا هو أول شراء لك لباقة Pro على StudyBuddy (استرداد واحد لكل مستخدم)؛"
                  : "This is your first Pro purchase on StudyBuddy (one refund per user);"}
              </li>
              <li>
                {language === "ar"
                  ? "لم يتجاوز حسابك حدود الاستخدام للتقييم المذكورة في القسم 4؛ و"
                  : "Your account has not exceeded the Evaluation Use Limits in Section 4; and"}
              </li>
              <li>
                {language === "ar"
                  ? "تم الشراء من خلال الدفع المباشر لـ StudyBuddy (موقع الويب). لمشتريات App Store / Google Play، انظر القسم 9."
                  : "The purchase was made through StudyBuddy’s direct checkout (web payments). For App Store / Google Play purchases, see Section 9."}
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4) {t("refundLimits")}</h2>
            <p>
              {language === "ar"
                ? "نظراً لأن القيمة الأساسية لـ StudyBuddy يتم تقديمها فوراً عبر مخرجات الذكاء الاصطناعي والتحليلات، فإن استرداد الأموال متاح فقط إذا ظل استخدام Pro ضمن حدود تقييم معقولة. إذا تجاوزت أي حد أدناه خلال فترة الاسترداد، يعتبر اشتراكك مستخدماً بشكل جوهري ويصبح غير قابل للاسترداد."
                : "Because StudyBuddy’s core value is delivered instantly via AI outputs and analysis, refunds are only available if Pro usage remains within reasonable evaluation limits. If you exceed any limit below during the Refund Window, your subscription is considered materially used and becomes non-refundable."}
            </p>

            <div className="pl-4 border-l-2 border-muted space-y-4">
              <h3 className="font-semibold text-lg">
                4.1{" "}
                {language === "ar"
                  ? "حدود الاستخدام الجوهري (خلال أول 7 أيام)"
                  : "Material-use limits (within the first 7 days)"}
              </h3>

              <p>
                {language === "ar"
                  ? "استرداد الأموال غير متاح إذا قمت بأي مما يلي:"
                  : "Refunds are not available if you have done any of the following:"}
              </p>

              <div className="space-y-4 mt-4">
                <div>
                  <h4 className="font-semibold">
                    A){" "}
                    {language === "ar"
                      ? "تحليل الاختبارات السابقة / تقرير العائد"
                      : "Past Exam Analysis / Yield Report"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? 'أكملت أي "تحليل اختبار سابق" ينتج عنه تعيين للمواضيع و/أو تقرير العائد.'
                        : "Completed any “Past Exam Analysis” that produces topic mapping and/or a Yield Report."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">
                    B) {language === "ar" ? "استخراج المنهج بالذكاء الاصطناعي" : "AI Syllabus Extraction"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "أجريت أكثر من 2 عملية استخراج للمنهج (PDF/صورة/OCR)."
                        : "Performed more than 2 AI syllabus extractions (PDF/image/OCR)."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">
                    C) {language === "ar" ? "إنشاء الاختبارات بالذكاء الاصطناعي" : "AI Quiz Generation"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "أنشأت أكثر من 25 اختباراً (أو مجموعات اختبارات مكافئة)."
                        : "Generated more than 25 AI quizzes (or equivalent quiz sets)."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">
                    D){" "}
                    {language === "ar" ? 'تحليل عميق للمواضيع ("تحليل الموضوع")' : "Topic Deep Dives (“Analyze Topic”)"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "أجريت أكثر من 10 تحليلات عميقة للمواضيع."
                        : "Performed more than 10 topic deep dives."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">
                    E) {language === "ar" ? "الخطة الذكية + مزامنة التقويم" : "Smart Plan + Calendar Sync"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "زامنت أكثر من 14 جلسة دراسية/حدثاً مع تقويم Google (أو أنشأت أكثر من 14 جلسة مجدولة داخل التطبيق)."
                        : "Synced more than 14 study sessions/events to Google Calendar (or created more than 14 scheduled sessions in-app if you mirror these)."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">F) {language === "ar" ? "المواد" : "Courses"}</h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "أنشأت أكثر من 2 مواد Pro (فوق حد الباقة المجانية)."
                        : "Created more than 2 Pro courses (beyond the free tier course limit)."}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">
                    G){" "}
                    {language === "ar" ? "التصدير / التنزيل (إذا كان متاحاً)" : "Exports / Downloads (if applicable)"}
                  </h4>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li>
                      {language === "ar"
                        ? "قمت بتصدير أو تنزيل أي تقرير/خطة مميزة (مثل تصدير تقرير العائد، تصدير PDF)."
                        : "Exported or downloaded any premium report/plan (e.g., Yield Report export, PDF export)."}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-lg mb-2">
                4.2 {language === "ar" ? "لماذا توجد هذه الحدود" : "Why these limits exist"}
              </h3>
              <p>
                {language === "ar"
                  ? 'تمثل هذه الإجراءات "الاستهلاك الأساسي" لقيمة StudyBuddy Pro وهي الأكثر عرضة لإساءة الاستخدام (مثل إنشاء اختبارات مكثفة، أو استخراج مناهج متعددة، أو إكمال تقارير العائد ثم طلب استرداد).'
                  : "These actions represent the “core consumption” of StudyBuddy’s Pro value and are the most susceptible to abuse (e.g., generating extensive quizzes, extracting multiple syllabi, or completing Yield Reports and then refunding)."}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5) {t("refundNonRefundable")}</h2>
            <p>
              {language === "ar"
                ? "سيتم رفض طلبات الاسترداد إذا انطبق أي مما يلي:"
                : "Refunds will be denied if any of the following applies:"}
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                {language === "ar"
                  ? "تجاوز حسابك حدود الاستخدام للتقييم (القسم 4)؛"
                  : "Your account exceeds the Evaluation Use Limits (Section 4);"}
              </li>
              <li>
                {language === "ar"
                  ? "طلبت استرداد الأموال بشكل متكرر (استرداد واحد لكل مستخدم/حساب، وقد نفرض ذلك أيضاً لكل وسيلة دفع/جهاز)؛"
                  : "You request refunds repeatedly (one refund per user/account, and we may also enforce per payment method/device);"}
              </li>
              <li>
                {language === "ar"
                  ? "اكتشفنا احتيالاً مشتبهاً به، أو إساءة استخدام للاسترداد، أو إساءة استخدام لرد المدفوعات، أو تحايلاً (مثل إنشاء حسابات جديدة لتكرار التجارب/الاسترداد)؛"
                  : "We detect suspected fraud, refund abuse, chargeback abuse, or circumvention (e.g., creating new accounts to repeat trials/refunds);"}
              </li>
              <li>
                {language === "ar"
                  ? "تم تقديم الطلب بعد انتهاء فترة الاسترداد؛"
                  : "The request is made after the Refund Window;"}
              </li>
              <li>
                {language === "ar"
                  ? "اشتريت عبر Apple/Google وسياساتهم لا تسمح بالاسترداد (القسم 9)."
                  : "You purchased via Apple/Google and their policy does not allow a refund (Section 9)."}
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6) {t("refundCancelVsRefund")}</h2>
            <p>
              {language === "ar"
                ? "إلغاء اشتراكك يمنع التجديد المستقبلي ولكنه لا يؤهلك تلقائياً لاسترداد الأموال. يتم تحديد أهلية الاسترداد بموجب هذه السياسة."
                : "Canceling your subscription prevents future renewals but does not automatically qualify you for a refund. Refund eligibility is determined by this policy."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7) {t("refundHowToRequest")}</h2>
            <p>
              {language === "ar"
                ? "أرسل بريداً إلكترونياً إلى mohamed.khair@qobouli.com مع:"
                : "Email mohamed.khair@qobouli.com with:"}
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                {language === "ar"
                  ? "عنوان البريد الإلكتروني لحساب StudyBuddy الخاص بك"
                  : "The email address on your StudyBuddy account"}
              </li>
              <li>{language === "ar" ? "رقم الطلب / إيصال المعاملة" : "Your order ID / transaction receipt"}</li>
              <li>{language === "ar" ? "ملاحظة قصيرة تطلب الاسترداد" : "A short note requesting a refund"}</li>
            </ul>
            <p className="mt-2">
              {language === "ar"
                ? "إذا كنت مؤهلاً، فسنقوم برد الأموال إلى وسيلة الدفع الأصلية."
                : "If you are eligible, we will refund the original payment method."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8) {t("refundProcessing")}</h2>
            <p>
              {language === "ar"
                ? "تتم معالجة المبالغ المستردة المعتمدة عادةً في غضون 5-10 أيام عمل (قد تختلف أوقات المعالجة المصرفية)."
                : "Approved refunds are typically processed within 5–10 business days (bank processing times may vary)."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9) {t("refundAppStore")}</h2>
            <p>
              {language === "ar"
                ? "إذا اشتريت Pro من خلال Apple App Store أو Google Play، فإن عمليات الاسترداد تتم بواسطة Apple/Google وفقاً لسياساتهم، وقد لا تتمكن StudyBuddy من إصدار الاسترداد مباشرة."
                : "If you purchased Pro through the Apple App Store or Google Play, refunds are handled by Apple/Google according to their policies, and StudyBuddy may not be able to issue the refund directly."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10) {t("refundEnforcement")}</h2>
            <p>
              {language === "ar"
                ? "قد نستخدم سجلات الاستخدام (مثل عدد استخراجات المنهج، والاختبارات التي تم إنشاؤها، والتحليلات التي تم تشغيلها، وأحداث مزامنة التقويم) لتحديد الأهلية لاسترداد الأموال. تُستخدم هذه السجلات فقط لمنع الاحتيال، ودعم العملاء، وتنفيذ هذه السياسة."
                : "We may use usage logs (e.g., number of syllabus extractions, quizzes generated, analyses run, calendar sync events) to determine refund eligibility. These logs are used solely for fraud prevention, customer support, and enforcing this policy."}
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">11) {t("refundChanges")}</h2>
            <p>
              {language === "ar"
                ? "قد نقوم بتحديث هذه السياسة من وقت لآخر. النسخة المطبقة على مشترياتك هي النسخة السارية في وقت الشراء."
                : "We may update this policy from time to time. The version applicable to your purchase is the one in effect at the time of purchase."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
