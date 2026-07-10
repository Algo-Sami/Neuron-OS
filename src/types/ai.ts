export interface ExtractedDeadline {
  title: string;
  description: string;
  dueDate: string; // ISO 8601 string
  type: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic';
  priority: 'low' | 'medium' | 'high';
  course?: string; // e.g. Operating Systems
}

export interface DocumentClassification {
  subject: string;
  topic: string;
  docType: string;
  confidence: number;
  tags: string[];
}
