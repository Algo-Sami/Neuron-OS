/**
 * AI File Classification Service
 *
 * Classifies uploaded files into one of three AI processing categories
 * using only the filename — zero network cost, zero API calls, runs instantly.
 *
 * Category 1 → 'auto'    Core learning material — auto-trigger AI generation
 * Category 2 → 'confirm' Assessment material   — ask user before generating
 * Category 3 → 'skip'    Administrative docs   — never trigger AI
 */

// ── Category Definitions ──────────────────────────────────────────────────────

export type AICategory = 'auto' | 'confirm' | 'skip';
export type DocTypeGroup = 'lecture' | 'assessment' | 'admin' | 'unknown';

export interface FileClassification {
  /** How AI generation should be triggered for this file */
  category: AICategory;
  /** Semantic group — used for preference lookups */
  docTypeGroup: DocTypeGroup;
  /** Human-readable label for the detected type, e.g. "Lecture Notes" */
  label: string;
}

// ── Keyword Maps ──────────────────────────────────────────────────────────────

const AUTO_KEYWORDS: Array<{ words: string[]; label: string }> = [
  { words: ['lecture'],                              label: 'Lecture' },
  { words: ['lec'],                                  label: 'Lecture' },
  { words: ['class notes', 'classnotes'],            label: 'Class Notes' },
  { words: ['notes', 'note'],                        label: 'Notes' },
  { words: ['handwritten'],                          label: 'Handwritten Notes' },
  { words: ['slides', 'slide'],                      label: 'Slides' },
  { words: ['presentation', 'present'],              label: 'Presentation' },
  { words: ['ppt', 'pptx'],                         label: 'Presentation' },
  { words: ['chapter', 'chap', 'ch'],                label: 'Chapter' },
  { words: ['unit'],                                 label: 'Unit Notes' },
  { words: ['reading', 'readings'],                  label: 'Reading Material' },
  { words: ['handout', 'hand out', 'hand-out'],      label: 'Handout' },
  { words: ['study guide', 'study-guide'],           label: 'Study Guide' },
  { words: ['summary', 'summaries'],                 label: 'Summary' },
  { words: ['textbook', 'text book'],                label: 'Textbook Material' },
  { words: ['reference'],                            label: 'Reference Material' },
  { words: ['tutorial', 'tut'],                      label: 'Tutorial' },
];

const CONFIRM_KEYWORDS: Array<{ words: string[]; label: string; group: DocTypeGroup }> = [
  { words: ['assignment', 'assign'],                          label: 'Assignment',    group: 'assessment' },
  { words: ['homework', 'home work', 'hw'],                  label: 'Homework',      group: 'assessment' },
  { words: ['quiz'],                                         label: 'Quiz',          group: 'assessment' },
  { words: ['midterm', 'mid term', 'mid-term', 'midsem'],   label: 'Midterm Exam',  group: 'assessment' },
  { words: ['sessional'],                                    label: 'Sessional Exam', group: 'assessment' },
  { words: ['final exam', 'final-exam', 'finalexam'],        label: 'Final Exam',    group: 'assessment' },
  { words: ['exam', 'examination'],                          label: 'Exam Paper',    group: 'assessment' },
  { words: ['project'],                                      label: 'Project',       group: 'assessment' },
  { words: ['lab task', 'lab-task', 'labtask'],             label: 'Lab Task',      group: 'assessment' },
  { words: ['lab assignment', 'lab-assignment'],             label: 'Lab Assignment', group: 'assessment' },
  { words: ['lab', 'lab work', 'labwork', 'practical'],     label: 'Lab Material',  group: 'assessment' },
  { words: ['past paper', 'past-paper', 'pastpaper'],        label: 'Past Paper',    group: 'assessment' },
  { words: ['paper'],                                        label: 'Paper',         group: 'assessment' },
  { words: ['research'],                                     label: 'Research',      group: 'assessment' },
];

const SKIP_KEYWORDS: Array<{ words: string[] }> = [
  { words: ['fee challan', 'fee-challan', 'challan'] },
  { words: ['timetable', 'time table', 'time-table', 'schedule'] },
  { words: ['attendance', 'attendance sheet'] },
  { words: ['registration form', 'registration-form'] },
  { words: ['admission form', 'admission-form'] },
  { words: ['course outline', 'course-outline', 'syllabus'] },
  { words: ['notice', 'circular', 'announcement'] },
  { words: ['id card', 'identity card', 'idcard'] },
  { words: ['fee receipt', 'receipt'] },
  { words: ['administrative', 'admin letter'] },
  { words: ['transcript', 'grade sheet', 'marksheet'] },
  { words: ['certificate'] },
];

// ── Utility ───────────────────────────────────────────────────────────────────

function normalise(fileName: string): string {
  return fileName
    .toLowerCase()
    // Remove extension
    .replace(/\.[^.]+$/, '')
    // Replace separators with spaces
    .replace(/[_\-\.]+/g, ' ')
    .trim();
}

function matchesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

// ── Main Classifier ───────────────────────────────────────────────────────────

/**
 * Classify a file by its name into an AI processing category.
 * Pure function — no network calls, no side effects.
 *
 * @param fileName  The original uploaded filename including extension
 * @returns         FileClassification with category, group, and label
 */
export function classifyFile(fileName: string): FileClassification {
  const text = normalise(fileName);

  // Priority 1 — Check for admin/skip keywords (most restrictive, checked first)
  for (const entry of SKIP_KEYWORDS) {
    if (matchesAny(text, entry.words)) {
      return { category: 'skip', docTypeGroup: 'admin', label: 'Administrative Document' };
    }
  }

  // Priority 2 — Check for assessment/confirm keywords
  for (const entry of CONFIRM_KEYWORDS) {
    if (matchesAny(text, entry.words)) {
      return { category: 'confirm', docTypeGroup: entry.group, label: entry.label };
    }
  }

  // Priority 3 — Check for core learning material (auto)
  for (const entry of AUTO_KEYWORDS) {
    if (matchesAny(text, entry.words)) {
      return { category: 'auto', docTypeGroup: 'lecture', label: entry.label };
    }
  }

  // Default — treat as lecture material (most uploads are academic content)
  return { category: 'auto', docTypeGroup: 'lecture', label: 'Academic Document' };
}

/**
 * Given a user's AI automation preferences and a file classification,
 * determine whether to auto-generate, skip, or ask.
 * Incorporates per-category user overrides.
 */
export function resolveAIDecision(
  classification: FileClassification,
  prefs: {
    aiAutoLectures: boolean;
    aiAutoAssessments: boolean;
    aiAssessmentRememberedChoice: 'generate' | 'skip' | null;
  }
): AICategory {
  // Admin files are always skipped, regardless of preferences
  if (classification.category === 'skip') return 'skip';

  if (classification.category === 'auto') {
    // Respect the user's per-group preference toggle
    if (classification.docTypeGroup === 'lecture' && !prefs.aiAutoLectures) return 'skip';
    return 'auto';
  }

  if (classification.category === 'confirm') {
    // If the user has a saved preference for assessment files, honour it
    if (prefs.aiAutoAssessments) return 'auto';
    if (prefs.aiAssessmentRememberedChoice === 'generate') return 'auto';
    if (prefs.aiAssessmentRememberedChoice === 'skip') return 'skip';
    // No saved preference → show dialog
    return 'confirm';
  }

  return 'auto';
}
