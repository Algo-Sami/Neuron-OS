/**
 * Production-Grade Subject Classification & Upload Routing Types
 */

export type ClassificationMethod =
  | 'explicit_selection'
  | 'folder_context'
  | 'course_code'
  | 'exact_match'
  | 'fuzzy_match'
  | 'semantic_match'
  | 'llm'
  | 'user_confirmation'
  | 'uncategorized';

export interface UserSubjectAlias {
  id?: string;
  alias: string;
  source?: 'system' | 'user' | 'confirmed' | 'learned';
  confidence?: number;
  usageCount?: number;
  validated?: boolean;
}

export interface UserSubject {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  description?: string | null;
  representativeConcepts?: string[];
  aliases?: string[];
}

export interface ClassificationInput {
  userId: string;
  filename: string;
  mimeType?: string;
  subjectId?: string; // Layer 1: Explicit subject selection
  folderId?: string;  // Layer 2: Current folder context
  currentSubjectId?: string;
  extractedText?: string;
  chunks?: Array<{ content: string; embedding?: number[] }>;
}

export interface CandidateScore {
  subjectId: string;
  subjectName: string;
  score: number;
  method: ClassificationMethod;
  evidence: string[];
}

export interface SubjectClassificationResult {
  subjectId: string | null;
  subjectName: string | null;
  folderName: string | null;
  labSubfolderName: string | null;
  confidence: number;
  method: ClassificationMethod;
  reason?: string;
  needsUserConfirmation?: boolean;
  candidateSubjects?: Array<{
    subjectId: string;
    subjectName: string;
    confidence: number;
  }>;
  evidence?: string[];
}

export interface SubjectProfileData {
  subjectId: string;
  profileText: string;
  representativeConcepts: string[];
  embedding?: number[];
}
