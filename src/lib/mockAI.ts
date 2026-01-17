// Mock AI service to extract topics from text
// In a real app, this would call an LLM API.

export interface ExtractedTopic {
  title: string;
  difficulty_weight: number;
  exam_importance: number;
  notes?: string;
}

export interface AIResponse {
  course_title?: string;
  needs_review: boolean;
  extracted_topics: ExtractedTopic[];
  questions_for_student?: string[];
}

export function parseLines(text: string): string[] {
  // Optimized parsing: Match non-newline sequences and trim/filter in one pass logic.
  // Using match with reduce avoids splitting into a huge array of strings (including empty ones).
  return (text.match(/[^\r\n]+/g) || []).reduce((acc, line) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) acc.push(trimmed);
    return acc;
  }, [] as string[]);
}

export async function extractTopics(text: string): Promise<AIResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // If the text looks like JSON, try to parse it (easter egg or for testing)
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
          const parsed = JSON.parse(text);
          if (parsed.extracted_topics) return parsed;
      } catch (e) {
          // ignore
      }
  }

  // Simple heuristic parsing for the mock:
  // Assign random weights for demonstration.
  const lines = parseLines(text);

  const topics: ExtractedTopic[] = lines.map(line => ({
    title: line,
    difficulty_weight: Math.floor(Math.random() * 5) + 1, // 1-5
    exam_importance: Math.floor(Math.random() * 5) + 1, // 1-5
    notes: ""
  }));

  return {
    needs_review: false,
    extracted_topics: topics
  };
}
