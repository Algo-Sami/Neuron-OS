/**
 * Study Pack Generator
 *
 * Generates structured JSON for 6 academic resource types from extracted document text.
 * Each resource type is generated independently — a failure in one does NOT stop others.
 * Add new resource types by extending GENERATORS and StudyPackContent.
 */

import { routeAIRequest } from './router';
import { logger } from '@/lib/logger';

// ── Content Type Definitions ──────────────────────────────────────────────────

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
  correctAnswer: number; // 0–3 (index into options)
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
}

// ── Generator Configuration Map ───────────────────────────────────────────────
// To add a new resource type: add a key to StudyPackContent and an entry here.

type TaskType = 'summary' | 'key-concepts' | 'flashcards' | 'quiz-generation' | 'revision-notes';

export const GENERATORS: Record<keyof StudyPackContent, {
  taskType: TaskType;
  textLimit: number;
  buildPrompt: (text: string, fileName: string) => string;
}> = {
  summary: {
    taskType: 'summary',
    textLimit: 15000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Analyze the document and generate a structured study summary.
Document: "${fileName}"

Output ONLY valid JSON with this exact structure:
{
  "learningObjectives": ["3-5 specific learning objectives"],
  "overview": "3-5 sentence comprehensive overview",
  "keyConceptsList": ["6-8 key concepts as strings"],
  "keyTakeaways": ["5-7 important takeaways as strings"]
}

No markdown fences. No extra text. JSON only.

DOCUMENT TEXT:
${text}`,
  },

  keyConcepts: {
    taskType: 'key-concepts',
    textLimit: 15000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Extract the major concepts from this document.
Document: "${fileName}"

Output ONLY a valid JSON array:
[
  {
    "concept": "Concept name (3-6 words)",
    "definition": "Clear 1-2 sentence definition",
    "example": "Optional short example or use case"
  }
]

Generate 10-14 key concepts. No markdown fences. JSON array only.

DOCUMENT TEXT:
${text}`,
  },

  definitions: {
    taskType: 'key-concepts',
    textLimit: 15000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Extract important terminology and definitions.
Document: "${fileName}"

Output ONLY a valid JSON array:
[
  {
    "term": "Technical term or acronym",
    "definition": "Precise 1-2 sentence academic definition"
  }
]

Generate 12-18 definitions. Cover technical terms, acronyms, and important vocabulary. No markdown fences. JSON only.

DOCUMENT TEXT:
${text}`,
  },

  flashcards: {
    taskType: 'flashcards',
    textLimit: 12000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Create study flashcards for active recall.
Document: "${fileName}"

Output ONLY a valid JSON array:
[
  {
    "front": "Question, term, or incomplete statement",
    "back": "Answer, definition, or completion"
  }
]

Generate 15-20 flashcards. Each tests ONE concept. No markdown fences. JSON only.

DOCUMENT TEXT:
${text}`,
  },

  mcqs: {
    taskType: 'quiz-generation',
    textLimit: 12000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Create multiple-choice questions for exam practice.
Document: "${fileName}"

Output ONLY a valid JSON array:
[
  {
    "question": "Clear, specific question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct and others are wrong"
  }
]

"correctAnswer" is the 0-based index (0=A, 1=B, 2=C, 3=D).
Generate 10-12 questions mixing easy, medium, and hard difficulty. No markdown fences. JSON only.

DOCUMENT TEXT:
${text}`,
  },

  practiceQuestions: {
    taskType: 'summary',
    textLimit: 12000,
    buildPrompt: (text, fileName) =>
      `You are an academic study assistant. Generate practice questions for exam preparation.
Document: "${fileName}"

Output ONLY valid JSON with this exact structure:
{
  "shortQuestions": ["5-6 factual questions answerable in 2-3 sentences"],
  "longQuestions": ["3-4 detailed questions requiring essay-type answers"],
  "conceptualQuestions": ["3-4 analysis/application/critical thinking questions"]
}

No markdown fences. JSON only.

DOCUMENT TEXT:
${text}`,
  },
};

// ── Public helper for background jobs ────────────────────────────────────────

/**
 * Returns the generation prompt for a given StudyPackContent key.
 * Designed for background jobs that bypass routeAIRequest.
 */
export function getPromptForKey(
  key: keyof StudyPackContent,
  text: string,
  fileName: string,
): string {
  const config = GENERATORS[key];
  const bounded = text.substring(0, config.textLimit);
  return config.buildPrompt(bounded, fileName);
}

// ── Core Generation Function ──────────────────────────────────────────────────

export async function generateResource<T>(
  key: keyof StudyPackContent,
  userId: string,
  text: string,
  fileName: string
): Promise<T | null> {
  const config = GENERATORS[key];
  const boundedText = text.substring(0, config.textLimit);
  const prompt = config.buildPrompt(boundedText, fileName);

  try {
    const res = await routeAIRequest({
      userId,
      taskType: config.taskType,
      prompt,
      responseMimeType: 'application/json',
      skipCache: true,
      maxOutputTokens: 8192,
    });

    if (!res.success) {
      logger.warn(`[StudyPackGenerator] ${key} generation unsuccessful: ${res.content.substring(0, 120)}`);
      return null;
    }

    // Strip markdown fences if the model added them despite instructions
    let rawJson = res.content.trim();
    if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
    }

    const parsed = JSON.parse(rawJson) as T;
    logger.info(`[StudyPackGenerator] ✓ ${key} generated successfully`);
    return parsed;
  } catch (err) {
    logger.error(`[StudyPackGenerator] ✗ ${key} generation failed:`, err);
    return null;
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Generates all 6 academic resource types concurrently.
 * Failures are independent — partial results are returned.
 */
export async function generateStudyPackContent(
  userId: string,
  extractedText: string,
  fileName: string
): Promise<StudyPackContent> {
  logger.info(`[StudyPackGenerator] Starting parallel generation for: "${fileName}"`);

  const [summary, keyConcepts, definitions, flashcards, mcqs, practiceQuestions] =
    await Promise.allSettled([
      generateResource<StudySummary>('summary', userId, extractedText, fileName),
      generateResource<KeyConceptItem[]>('keyConcepts', userId, extractedText, fileName),
      generateResource<DefinitionItem[]>('definitions', userId, extractedText, fileName),
      generateResource<FlashcardItem[]>('flashcards', userId, extractedText, fileName),
      generateResource<MCQItem[]>('mcqs', userId, extractedText, fileName),
      generateResource<PracticeQuestionsSet>('practiceQuestions', userId, extractedText, fileName),
    ]);

  const results: StudyPackContent = {
    summary:           summary.status === 'fulfilled' ? summary.value : null,
    keyConcepts:       keyConcepts.status === 'fulfilled' ? keyConcepts.value : null,
    definitions:       definitions.status === 'fulfilled' ? definitions.value : null,
    flashcards:        flashcards.status === 'fulfilled' ? flashcards.value : null,
    mcqs:              mcqs.status === 'fulfilled' ? mcqs.value : null,
    practiceQuestions: practiceQuestions.status === 'fulfilled' ? practiceQuestions.value : null,
  };

  const successCount = Object.values(results).filter(v => v !== null).length;
  logger.info(`[StudyPackGenerator] Generation complete: ${successCount}/6 resources succeeded`);

  return results;
}
