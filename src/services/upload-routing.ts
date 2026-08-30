import {
  DEFAULT_LEGACY_SYNONYMS,
  IGNORE_WORDS as CONFIG_IGNORE_WORDS,
} from './classification/config';
import { resolveFolderCategory } from './classification/classifier';
import { normalizeFilenameTokens } from './classification/layers/layer4-exact-match';

export interface KeywordMapping {
  keywords: string[];
  folderName: string;
}

export const DEFAULT_KEYWORD_MAPPINGS: KeywordMapping[] = [
  { keywords: ['presentation', 'ppt', 'pptx', 'slides', 'seminar'], folderName: 'Presentations' },
  { keywords: ['assignment', 'homework', 'task', 'project-milestone'], folderName: 'Assignments' },
  { keywords: ['lecture', 'lec', 'class'], folderName: 'Lectures' },
  { keywords: ['quiz', 'exam', 'test', 'assessment', 'midterm', 'final'], folderName: 'Quizzes' },
  { keywords: ['project', 'capstone', 'implementation'], folderName: 'Projects' },
];

/**
 * Legacy synonyms dictionary maintained for backward compatibility.
 * Primary source of truth is now the user's dynamic subjects and subject_aliases table.
 */
export const SUBJECT_SYNONYMS: Record<string, string[]> = DEFAULT_LEGACY_SYNONYMS;

export const IGNORE_WORDS = CONFIG_IGNORE_WORDS;

export interface RoutingResult {
  subjectName: string;
  folderName: string | null;
  labSubfolderName: string | null;
  confidence: number;
}

/**
 * Capitalize a string to Title Case, keeping acronyms uppercase.
 */
export function toTitleCase(text: string): string {
  return text
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (/^[A-Z]{2,5}$/.test(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalizes a subject name using token normalization and legacy aliases.
 */
export function normalizeSubjectName(name: string): string {
  const cleaned = normalizeFilenameTokens(name);

  // Search in synonym mappings
  for (const [canonical, synonyms] of Object.entries(SUBJECT_SYNONYMS)) {
    if (cleaned === canonical.toLowerCase()) {
      return canonical;
    }
    for (const synonym of synonyms) {
      if (cleaned === synonym.toLowerCase()) {
        return canonical;
      }
    }
  }

  return toTitleCase(cleaned);
}

/**
 * Legacy filename classifier maintained for backwards compatibility.
 * For production subject classification, use SubjectClassifier.classify().
 */
export function classifyFilename(
  fileName: string,
  _mappings: KeywordMapping[] = DEFAULT_KEYWORD_MAPPINGS
): RoutingResult {
  const { folderName, labSubfolderName } = resolveFolderCategory(fileName);
  const normalizedSubject = normalizeSubjectName(fileName);

  if (normalizedSubject.length >= 2 && !IGNORE_WORDS.includes(normalizedSubject.toLowerCase())) {
    return {
      subjectName: normalizedSubject,
      folderName: folderName || 'Lectures',
      labSubfolderName,
      confidence: 0.85,
    };
  }

  return {
    subjectName: '',
    folderName: folderName || 'Lectures',
    labSubfolderName,
    confidence: 0.0,
  };
}
