import { importantNotes, automataNote } from '@/data/studySchedule';

export function ImportantNotes() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4 text-right flex items-center justify-end gap-2">
        📝 ملاحظات (مهمّة جدًا)
      </h2>
      
      <div className="bg-card border border-border p-4 mb-4">
        <p className="text-muted-foreground text-sm text-right leading-relaxed">
          {automataNote}
        </p>
      </div>
      
      <ul className="space-y-3 text-right">
        {importantNotes.map((note, index) => (
          <li key={index} className="text-muted-foreground text-sm flex items-start gap-2 justify-end">
            <span>{note}</span>
            <span className="text-foreground">•</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
