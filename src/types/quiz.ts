export interface GeneratedQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  keyPoints?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}
