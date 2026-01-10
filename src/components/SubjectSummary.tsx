import { subjectSummary } from '@/data/studySchedule';

export function SubjectSummary() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4 text-right">
        1) ملخص الأيام لكل مادة (مع أسماء الأيام)
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right p-3 text-foreground font-semibold">المادة</th>
              <th className="text-right p-3 text-foreground font-semibold">عدد الأيام (إجمالي "تلامس" المادة)</th>
              <th className="text-right p-3 text-foreground font-semibold">الأيام (بالتواريخ + اسم اليوم)</th>
            </tr>
          </thead>
          <tbody>
            {subjectSummary.map((item, index) => (
              <tr key={index} className="border-b border-border">
                <td className="p-3 text-foreground">
                  <span className="font-bold">{item.subject}</span>
                  <br />
                  <span className="text-muted-foreground text-sm">{item.examDate}</span>
                </td>
                <td className="p-3 text-muted-foreground">{item.totalDays}</td>
                <td className="p-3 text-muted-foreground text-sm">{item.schedule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
