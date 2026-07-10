export type StageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface StageProgress {
  status:         StageStatus;
  startTime?:     string;
  endTime?:       string;
  durationMs?:    number;
  attempts?:      number;
  errorCategory?: string;
  errorMessage?:  string;
}

/**
 * Phase 1 — Document Ingestion only.
 * Future phases (embeddings, summaries, etc.) will extend this when implemented.
 */
export interface TaskProgress {
  overallStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  stages: {
    extraction:      StageProgress;  // Download → Extract → Clean → Validate → Save Knowledge
    chunking:        StageProgress;  // Chunk Document → Save Chunks
    verification:    StageProgress;  // 9-point ingestion verification
    embedding:       StageProgress;  // Phase 2: Generate embeddings for chunks
    knowledgeVerify: StageProgress;  // Phase 2: 9-point knowledge/embedding verification
    summaryGen?:     StageProgress;  // Generate academic summary via Summary Skill
    pdfRender?:      StageProgress;  // Render summary into a PDF and sync
  };
}


export interface StudySummary {
  learningObjectives: string[];
  overview: string;
  keyConceptsList: string[];
  keyTakeaways: string[];
}

export interface KeyConceptItem {
  concept: string;
  definition: string;
  example?: string;
}

export interface DefinitionItem {
  term: string;
  definition: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface MCQItem {
  question: string;
  options: [string, string, string, string];
  correctAnswer: number; // 0–3
  explanation: string;
}

export interface PracticeQuestionsSet {
  shortQuestions: string[];
  longQuestions: string[];
  conceptualQuestions: string[];
}

export interface StudyPackContent {
  summary: StudySummary | null;
  keyConcepts: KeyConceptItem[] | null;
  definitions: DefinitionItem[] | null;
  flashcards: FlashcardItem[] | null;
  mcqs: MCQItem[] | null;
  practiceQuestions: PracticeQuestionsSet | null;
  studyGuide?: any | null;
}
