// Allocation Engine Logic
// Distributes topics from today until the exam date based on weights.

interface Topic {
  id: string;
  difficulty_weight: number;
  exam_importance: number;
}

interface Allocation {
  date: string; // YYYY-MM-DD
  topics: string[]; // Topic IDs
}

export function generateAllocation(
  topics: Topic[],
  examDateStr: string,
  startDateStr: string = new Date().toISOString().split('T')[0]
): Allocation[] {
  const examDate = new Date(examDateStr);
  const startDate = new Date(startDateStr);

  // Basic validation
  if (examDate <= startDate) {
      // If exam is today or past, dump everything into today (or handle error)
      return [{
          date: startDateStr,
          topics: topics.map(t => t.id)
      }];
  }

  const oneDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(Math.abs((examDate.getTime() - startDate.getTime()) / oneDay));

  // Available study days (excluding exam day usually, but let's include up to day before)
  const availableDays = Math.max(1, daysDiff);

  // Sort topics by score (Importance * Difficulty) desc
  // Higher score = needs more attention, maybe schedule earlier or review more often?
  // PRD says: "Higher score topics should appear earlier or more frequently"
  // For MVP, we just distribute them once.

  const sortedTopics = [...topics].sort((a, b) => {
      const scoreA = a.difficulty_weight * a.exam_importance;
      const scoreB = b.difficulty_weight * b.exam_importance;
      return scoreB - scoreA;
  });

  const allocations: Allocation[] = [];
  const topicsPerDay = Math.ceil(sortedTopics.length / availableDays);

  let currentTopicIndex = 0;

  for (let i = 0; i < availableDays; i++) {
      const currentDate = new Date(startDate.getTime() + i * oneDay);
      const dateStr = currentDate.toISOString().split('T')[0];

      const daysTopics: string[] = [];

      for (let j = 0; j < topicsPerDay; j++) {
          if (currentTopicIndex < sortedTopics.length) {
              daysTopics.push(sortedTopics[currentTopicIndex].id);
              currentTopicIndex++;
          }
      }

      if (daysTopics.length > 0) {
          allocations.push({
              date: dateStr,
              topics: daysTopics
          });
      }
  }

  return allocations;
}
