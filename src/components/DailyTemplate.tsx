import { dailyTemplate } from '@/data/studySchedule';

export function DailyTemplate() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4 text-right flex items-center justify-end gap-2">
        📅 قالب يوم الدراسة (مناسب لـ ADHD-PI + يوتيوب + مسائل)
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right p-3 text-foreground font-semibold">الوقت</th>
              <th className="text-right p-3 text-foreground font-semibold">ماذا تعمل</th>
              <th className="text-right p-3 text-foreground font-semibold">المدة</th>
            </tr>
          </thead>
          <tbody>
            {dailyTemplate.map((block, index) => (
              <tr key={index} className="border-b border-border">
                <td className="p-3 text-foreground font-medium whitespace-nowrap">{block.time}</td>
                <td className="p-3 text-foreground">{block.activity}</td>
                <td className="p-3 text-muted-foreground">{block.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <p className="text-muted-foreground text-sm mt-4 text-right">
        الإجمالي الصافي: ~ 5 ساعات 45 دقيقة (إذا عملت بلوك المساء) أو 5 ساعات بدون المساء.
      </p>
    </div>
  );
}
