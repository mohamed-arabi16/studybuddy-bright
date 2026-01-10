import { dayTypes } from '@/data/studySchedule';

export function DayTypesTable() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4 text-right flex items-center justify-end gap-2">
        📅 "كم لازم أدرس باليوم؟" — هدف واضح بالأرقام
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right p-3 text-foreground font-semibold">نوع اليوم</th>
              <th className="text-right p-3 text-foreground font-semibold">الهدف (دراسة صافية)</th>
              <th className="text-right p-3 text-foreground font-semibold">عدد البلوكات</th>
              <th className="text-right p-3 text-foreground font-semibold">ملاحظات سريعة</th>
            </tr>
          </thead>
          <tbody>
            {dayTypes.map((item, index) => (
              <tr key={index} className="border-b border-border">
                <td className="p-3 text-foreground font-medium">{item.type}</td>
                <td className="p-3 text-foreground">{item.studyHours}</td>
                <td className="p-3 text-muted-foreground">{item.blocks}</td>
                <td className="p-3 text-muted-foreground">{item.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
