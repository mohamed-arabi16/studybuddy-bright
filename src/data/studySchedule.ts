export interface StudyTask {
  id: string;
  subject: "os" | "circuits" | "automata";
  topic: string;
  hasQuizLink?: string;
}

export interface StudyDay {
  date: string;
  dayAr: string;
  osTasks: StudyTask[];
  circuitsTasks: StudyTask[];
  automataTasks: StudyTask[];
}

export interface Exam {
  id: string;
  subjectAr: string;
  date: Date;
}

export interface DayType {
  type: string;
  studyHours: string;
  blocks: string;
  notes: string;
}

export interface DailyBlock {
  time: string;
  activity: string;
  duration: string;
}

// Use explicit timezone to avoid parsing issues
function createExamDate(dateStr: string, time: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
}

export const exams: Exam[] = [
  {
    id: "os",
    subjectAr: "Operating Systems",
    date: createExamDate("2026-01-09", "08:00"),
  },
  {
    id: "circuits",
    subjectAr: "Circuits",
    date: createExamDate("2026-01-12", "11:30"),
  },
  {
    id: "automata",
    subjectAr: "Automata",
    date: createExamDate("2026-01-12", "16:30"),
  },
];

export const subjectSummary = [
  {
    subject: "Operating Systems",
    examDate: "(امتحان 9/1)",
    totalDays: "10 أيام + مراجعة يوم الامتحان",
    schedule: "29/12 الاثنين ← 8/1 الخميس (شغل شبه يومي) + 9/1 الجمعة مراجعة صباحًا ثم امتحان",
  },
  {
    subject: "Circuits",
    examDate: "(امتحان 12/1 11:30)",
    totalDays: "جرعات قصيرة قبل 9/1 + يومين ضغط + مراجعة الامتحان",
    schedule:
      "29/12 الاثنين ← 8/1 الخميس (جرعات مسائل 45-60 دقيقة معظم الأيام) + 10/1 السبت + 11/1 الأحد ضغط كامل + 12/1 الاثنين مراجعة صباحًا ثم امتحان",
  },
  {
    subject: "Automata",
    examDate: "(امتحان 12/1 16:30)",
    totalDays: "جرعات قصيرة قبل 9/1 + يوم ضغط + مراجعة الامتحان",
    schedule:
      "29/12 الاثنين ← 8/1 الخميس (جرعات 45 دقيقة معظم الأيام) + 11/1 الأحد ضغط كامل + 12/1 الاثنين مراجعة قبل الامتحان ثم امتحان",
  },
];

export const dayTypes: DayType[] = [
  {
    type: "يوم دراسة طبيعي (قبل امتحان OS 9/1)",
    studyHours: "5.0-5.5 ساعات",
    blocks: "5 بلوكات",
    notes: "OS هو الأساسي + جرعات قصيرة Circuits/Automata",
  },
  {
    type: "يوم دراسة ضغط (10-11/1 قبل Circuits/Automata)",
    studyHours: "6.0-7.0 ساعات",
    blocks: "6 بلوكات",
    notes: "مسائل أكثر، فيديو أقل",
  },
  {
    type: "يوم تصوير",
    studyHours: "0-45 دقيقة فقط",
    blocks: "0-1 بلوك",
    notes: "مراجعة خفيفة/فلاش كارد فقط (اختياري)",
  },
  {
    type: "يوم طاقة منخفضة",
    studyHours: "3.0 ساعات",
    blocks: "3 بلوكات",
    notes: "نحافظ على الاستمرارية بدل الانقطاع",
  },
];

export const dailyTemplate: DailyBlock[] = [
  { time: "08:30 - 10:00", activity: "OS (فيديو + ملاحظات)", duration: "90 د" },
  { time: "10:15 - 11:45", activity: "OS (حل مسائل/أسئلة)", duration: "90 د" },
  { time: "13:00 - 14:00", activity: "Circuits (مسائل فقط)", duration: "60 د" },
  { time: "14:15 - 15:00", activity: "Automata (مسألة/تحويل/CFG... حسب اليوم)", duration: "45 د" },
  { time: "16:30 - 17:15", activity: "OS مراجعة خفيفة / تلخيص ورقة واحدة", duration: "45 د" },
  { time: "20:30 - 21:00", activity: "مراجعة خفيفة جدًا (اختياري)", duration: "30 د" },
];

export const schedule: StudyDay[] = [
  {
    date: "27/12",
    dayAr: "السبت",
    osTasks: [],
    circuitsTasks: [],
    automataTasks: [],
  },
  {
    date: "28/12",
    dayAr: "الأحد",
    osTasks: [],
    circuitsTasks: [],
    automataTasks: [],
  },
  {
    date: "29/12",
    dayAr: "الاثنين",
    osTasks: [
      {
        id: "29-os-1",
        subject: "os",
        topic: "Fundamentals + Processes: roles, dual mode, interrupts + states + syscalls basics",
      },
    ],
    circuitsTasks: [{ id: "29-cir-1", subject: "circuits", topic: "Basics + KCL/KVL + Ohm + Nodal intro (2-3 مسائل)" }],
    automataTasks: [
      {
        id: "29-aut-1",
        subject: "automata",
        topic: "CFG basics + كتابة CFG لثلاث لغات بسيطة (بدأ بـ Quiz2 Q2)",
        hasQuizLink: "quiz2",
      },
    ],
  },
  {
    date: "30/12",
    dayAr: "الثلاثاء",
    osTasks: [{ id: "30-os-1", subject: "os", topic: "fork/exec/wait/exit + zombies + IPC (signals/pipes)" }],
    circuitsTasks: [{ id: "30-cir-1", subject: "circuits", topic: "Nodal + Supernode (3-4 مسائل)" }],
    automataTasks: [{ id: "30-aut-1", subject: "automata", topic: 'CFG + PDA الـ ε"1"0"1"ε', hasQuizLink: "quiz2" }],
  },
  {
    date: "31/12",
    dayAr: "الأربعاء",
    osTasks: [{ id: "31-os-1", subject: "os", topic: "CPU Scheduling: metrics + FCFS/SJF/SRTF/RR/Priority + مسائل" }],
    circuitsTasks: [{ id: "31-cir-1", subject: "circuits", topic: "Mesh + Supermesh (3-4 مسائل)" }],
    automataTasks: [
      {
        id: "31-aut-1",
        subject: "automata",
        topic: "Language from CFG* + Set* representation + PDA by empty stack",
        hasQuizLink: "quiz3",
      },
    ],
  },
  {
    date: "1/1",
    dayAr: "الخميس",
    osTasks: [
      {
        id: "1-os-1",
        subject: "os",
        topic: "Synchronization: critical section + mutex/semaphore/cond var + producer-consumer",
      },
    ],
    circuitsTasks: [
      {
        id: "1-cir-1",
        subject: "circuits",
        topic: "Theorems: source transform + superposition + Thevenin/Norton + max power",
      },
    ],
    automataTasks: [
      {
        id: "1-aut-1",
        subject: "automata",
        topic: "Grammar cleaning (خطوة): ε removal + unit + nullable + تمارين قصيرة epsilon idea",
      },
    ],
  },
  {
    date: "2/1",
    dayAr: "الجمعة",
    osTasks: [
      {
        id: "2-os-1",
        subject: "os",
        topic: "Memory basics: paging + TLB + (مراجعة مفاهيم EAT + demand paging + مسائل خفيفة)",
      },
    ],
    circuitsTasks: [
      {
        id: "2-cir-1",
        subject: "circuits",
        topic: "Op-amp (ideal rules) + grammar (Quiz4 Q2) inverting/non-inverting (مسألتين)",
      },
    ],
    automataTasks: [
      {
        id: "2-aut-1",
        subject: "automata",
        topic: "CNF pipeline: ε removal + unit + grammar (Quiz4) useless على CNF",
        hasQuizLink: "quiz4",
      },
    ],
  },
  {
    date: "3/1",
    dayAr: "السبت",
    osTasks: [
      {
        id: "3-os-1",
        subject: "os",
        topic: "Virtual memory: replacement (FIFO/LRU/Clock/OPT) + thrashing + ملفات (VSFS/inodes) نظرة",
      },
    ],
    circuitsTasks: [
      { id: "3-cir-1", subject: "circuits", topic: "RC/RL: time constant + step/source-free + initial conditions" },
    ],
    automataTasks: [
      { id: "3-aut-1", subject: "automata", topic: 'TM basics + TM الـ 1"0"1" (Quiz4 Q1)', hasQuizLink: "quiz4" },
    ],
  },
  {
    date: "4/1",
    dayAr: "الأحد",
    osTasks: [{ id: "4-os-1", subject: "os", topic: "Deadlocks: 4 conditions + RAG + prevention/avoidance/detection" }],
    circuitsTasks: [
      { id: "4-cir-1", subject: "circuits", topic: "RLC: series/parallel + overdamped/critical/underdamped" },
    ],
    automataTasks: [
      {
        id: "4-aut-1",
        subject: "automata",
        topic: 'TM تمرين "أكثر حساسية" (بدأ بمثل rem(n/3))',
        hasQuizLink: "finalExam_fall23-24",
      },
    ],
  },
  {
    date: "5/1",
    dayAr: "الاثنين",
    osTasks: [
      {
        id: "5-os-1",
        subject: "os",
        topic: "يوم مشروع زوجات: مراجعة خفيفة فقط flashcards: scheduling + sync (+) (paging)",
      },
    ],
    circuitsTasks: [],
    automataTasks: [],
  },
  {
    date: "6/1",
    dayAr: "الثلاثاء",
    osTasks: [{ id: "6-os-1", subject: "os", topic: "حل نموذج/أسئلة + Scheduling + Paging (جلسة مسائل) + سد الثغرات" }],
    circuitsTasks: [{ id: "6-cir-1", subject: "circuits", topic: "Mixed set: nodal/mesh + (3) thevenin/norton مسائل" }],
    automataTasks: [
      {
        id: "6-aut-1",
        subject: "automata",
        topic: "inequality/union/length ≤ CFG اللغات 5 (راجع Quiz2 Q2 بالكامل)",
        hasQuizLink: "quiz2",
      },
    ],
  },
  {
    date: "7/1",
    dayAr: "الأربعاء",
    osTasks: [
      {
        id: "7-os-1",
        subject: "os",
        topic: "File systems + system calls recap + حل أسئلة mixed (التركيز على نقاط ضعفك)",
      },
    ],
    circuitsTasks: [
      { id: "7-cir-1", subject: "circuits", topic: "Op-amp configs: (2) summing/diff/instrumentation مسائل" },
    ],
    automataTasks: [
      {
        id: "7-aut-1",
        subject: "automata",
        topic: "+ PDA design: CFG→PDA/acceptance (CFG+PDA) تمرين مشابه للفاينل",
        hasQuizLink: "finalExam_fall23-24",
      },
    ],
  },
  {
    date: "8/1",
    dayAr: "الخميس",
    osTasks: [
      { id: "8-os-1", subject: "os", topic: 'OS Final Review: "ورقة أخيرة" + حل أسئلة timed mock (أهم 3 محاور)' },
    ],
    circuitsTasks: [
      { id: "8-cir-1", subject: "circuits", topic: "RC/RL/RLC + theorems سريع: Sheet (مسألة واحدة من كل قسم)" },
    ],
    automataTasks: [
      { id: "8-aut-1", subject: "automata", topic: "CNF steps + TM patterns سريع: + Sheet PDA patterns" },
    ],
  },
  {
    date: "9/1",
    dayAr: "الجمعة",
    osTasks: [
      {
        id: "9-os-1",
        subject: "os",
        topic: "🎯 امتحان OS 2:00 PM: مراجعة خفيفة (+) Scheduling + Sync + Paging ثم امتحان",
      },
    ],
    circuitsTasks: [],
    automataTasks: [],
  },
  {
    date: "10/1",
    dayAr: "السبت",
    osTasks: [],
    circuitsTasks: [
      { id: "10-cir-1", subject: "circuits", topic: "ضغط كامل + Nodal/Mesh + theorems (جلسات مسائل كثيرة)" },
    ],
    automataTasks: [{ id: "10-aut-1", subject: "automata", topic: "جرعة خفيفة: CFG كتابة + Parse/Derivation basics" }],
  },
  {
    date: "11/1",
    dayAr: "الأحد",
    osTasks: [],
    circuitsTasks: [{ id: "11-cir-1", subject: "circuits", topic: "ضغط كامل + Op-amp + RC/RL + RLC (مع مسائل)" }],
    automataTasks: [
      {
        id: "11-aut-1",
        subject: "automata",
        topic: "ضغط كامل CNF + Grammar Automata: cleaning + TM + PDA (حل أسئلة فاينل/كويزات)",
      },
    ],
  },
  {
    date: "12/1",
    dayAr: "الاثنين",
    osTasks: [],
    circuitsTasks: [
      { id: "12-cir-1", subject: "circuits", topic: "🎯 امتحان Circuits 11:30 AM صباحًا مراجعة فقط ثم امتحان" },
    ],
    automataTasks: [
      {
        id: "12-aut-1",
        subject: "automata",
        topic: "🎯 امتحان Automata 16:30 PM : مراجعة نهائية (CNF/TM/PDA) patterns ثم امتحان",
      },
    ],
  },
];

export const importantNotes = [
  "بما أنك تعتمد على اليوتيوب: خلّي كل بلوك يمشي بهالقانون: 30-40 دقيقة فيديو + 10 دقائق ملاحظات + 40-60 دقيقة مسائل. بدون مسائل، ما بتثبت.",
  'قبل 9/1: OS هو المادة الرئيسية يوميًا. Circuits وAutomata "جرعات" حتى ما ينفجروا بعدين.',
  'أيام التصوير (بكرا وبعد بكرا): لا تحاول "تعوّض" بالليل. إذا بدك تعمل شي: 20 دقيقة فلاش كارد OS فقط.',
  'بخصوص مشروع OS: بما أنك قلت "بعدين"، تمام—بس انتبه: ساعات الدراسة اللي فوق لا تشمل المشروع. المشروع بده وقت منفصل وإلا رح يضغطك قبل 2/1.',
];

export const automataNote =
  "ملاحظة مهمّة عن Automata: الكويزات ونموذج الفاينل عندك يركزوا بشكل واضح على CFG/PDA/CNF/TM أكثر من DFA/NFA/Regex (مثلاً: CFG+PDA في Quiz2، Language from CFG + PDA، TM + CNF في Quiz3، Quiz4 في TM/PDA/CFG/Grammar cleaning وفاينل قديم).";
