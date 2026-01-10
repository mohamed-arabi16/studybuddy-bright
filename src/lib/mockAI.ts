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

export async function extractTopics(text: string): Promise<AIResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simple heuristic parsing for the mock:
  // Split by newlines, take non-empty lines as topics.
  // Assign random weights for demonstration.

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // If the text looks like JSON, try to parse it (easter egg or for testing)
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
          const parsed = JSON.parse(text);
          if (parsed.extracted_topics) return parsed;
      } catch (e) {
          // ignore
      }
  }

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
