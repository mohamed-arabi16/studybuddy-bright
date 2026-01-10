import { GlassCard } from '@/components/ui/GlassCard';
import { BookOpen, Clock, Brain, Lightbulb, AlertTriangle, ChevronDown } from 'lucide-react';
import { subjectSummary, dayTypes } from '@/data/studySchedule';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

function CollapsibleSection({ 
  title, 
  icon, 
  children, 
  borderClass = "" 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  borderClass?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <GlassCard className={`p-0 overflow-hidden ${borderClass}`}>
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-background/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6">
            {children}
          </div>
        </CollapsibleContent>
      </GlassCard>
    </Collapsible>
  );
}

export function StudySummarySection() {
  return (
    <div className="space-y-4 mb-8 animate-fade-in">
      {/* Subject Summary */}
      <CollapsibleSection
        title="📌 ملخص الأيام لكل مادة (مع أسماء الأيام)"
        icon={<BookOpen className="w-5 h-5 text-primary" />}
      >
        <div className="space-y-4">
          {subjectSummary.map((item, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-background/50 border border-border/30"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-bold text-foreground">{item.subject}</span>
                <span className="text-sm text-primary">{item.examDate}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium text-foreground/80">المدة:</span> {item.totalDays}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">الجدول:</span> {item.schedule}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Automata Important Note */}
      <CollapsibleSection
        title="⚠️ ملاحظة مهمّة عن Automata"
        icon={<AlertTriangle className="w-5 h-5 text-warning" />}
        borderClass="border-warning/30"
      >
        <p className="text-muted-foreground mb-4">
          الكويزات ونموذج الفاينل يركزوا بشكل واضح على:
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-success font-medium mb-2">✅ تركيز عالي</p>
            <p className="text-sm text-foreground/80">CFG / PDA / CNF / TM</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
            <p className="text-muted-foreground font-medium mb-2">❌ تركيز أقل</p>
            <p className="text-sm text-foreground/80">DFA / NFA / Regex</p>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Quiz2:</span> CFG + PDA
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Quiz3:</span> Language from CFG + PDA + TM + CNF
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Quiz4:</span> TM / PDA / CFG / Grammar cleaning
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">الفاينل القديم:</span> نفس النمط
          </p>
        </div>
      </CollapsibleSection>

      {/* Daily Study Goals */}
      <CollapsibleSection
        title="📊 كم لازم أدرس باليوم؟"
        icon={<Clock className="w-5 h-5 text-primary" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dayTypes.map((day, index) => (
            <div 
              key={index}
              className="p-4 rounded-xl bg-background/50 border border-border/30"
            >
              <p className="font-medium text-foreground text-sm mb-2">{day.type}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-primary font-bold">{day.studyHours}</span>
                <span className="text-muted-foreground">({day.blocks})</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{day.notes}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ADHD-PI Tips */}
      <CollapsibleSection
        title="💡 نصائح لطلاب ADHD-PI"
        icon={<Brain className="w-5 h-5 text-primary" />}
        borderClass="border-primary/20"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90">
              <span className="font-bold text-primary">قانون البلوك:</span> 30-40 دقيقة فيديو + 10 دقائق ملاحظات + 40-60 دقيقة مسائل. 
              <span className="text-warning font-medium"> بدون مسائل، ما بتثبت!</span>
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-foreground/80">⏱️ استخدم timer (Pomodoro) لتبقى focused</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-foreground/80">☕ خذ استراحات قصيرة بين البلوكات</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-foreground/80">📅 يوم طاقة منخفضة: 3 بلوكات فقط</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <p className="text-foreground/80">🔄 الاستمرارية أهم من الكمال</p>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
