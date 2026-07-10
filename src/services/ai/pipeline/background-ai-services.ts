import { SupabaseClient } from '@supabase/supabase-js';
import { generateWithBackoff } from '../background-generator';
import { getPromptForKey } from '../study-pack-generator';
import {
  KeyConceptItem,
  DefinitionItem,
  FlashcardItem,
  MCQItem,
  PracticeQuestionsSet
} from './types';
import { logger } from '@/lib/logger';

// ── Validation Helpers ────────────────────────────────────────────────────────

function validateKeyConcepts(data: any): data is KeyConceptItem[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item.concept === 'string' &&
        typeof item.definition === 'string'
    )
  );
}

function validateDefinitions(data: any): data is DefinitionItem[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item.term === 'string' &&
        typeof item.definition === 'string'
    )
  );
}

function validateFlashcards(data: any): data is FlashcardItem[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item.front === 'string' &&
        typeof item.back === 'string'
    )
  );
}

function validateMCQs(data: any): data is MCQItem[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item.question === 'string' &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        typeof item.correctAnswer === 'number' &&
        typeof item.explanation === 'string'
    )
  );
}

function validatePracticeQuestions(data: any): data is PracticeQuestionsSet {
  return (
    data &&
    Array.isArray(data.shortQuestions) &&
    Array.isArray(data.longQuestions) &&
    Array.isArray(data.conceptualQuestions)
  );
}

// ── Core Service Base Logic ──────────────────────────────────────────────────

async function runServiceWithCache<T>(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  stageName: string,
  storagePath: string,
  generatorPrompt: string,
  validator: (data: any) => data is T
): Promise<T> {
  // 1. Try loading from storage cache
  const { data: existingData, error: dlErr } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (!dlErr && existingData) {
    logger.info(`[BackgroundAI][${stageName}] Reusing cached JSON from storage`);
    try {
      const parsed = JSON.parse(await existingData.text());
      if (validator(parsed)) {
        return parsed;
      }
    } catch { /* parse failure -> regenerate */ }
  }

  // 2. Generate content via Gemini
  logger.info(`[BackgroundAI][${stageName}] Querying AI...`);
  const rawResult = await generateWithBackoff(
    `${documentId.substring(0, 8)}-${stageName.toLowerCase()}`,
    generatorPrompt,
    3
  );

  // 3. Validate structured output
  if (!validator(rawResult)) {
    throw new Error(`Output validation failed for ${stageName}. Structure does not match expected interface.`);
  }

  // 4. Save JSON to storage
  const jsonBuf = Buffer.from(JSON.stringify(rawResult, null, 2));
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, jsonBuf, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true
    });

  if (upErr) {
    logger.warn(`[BackgroundAI][${stageName}] Failed to save JSON file to storage: ${upErr.message}`);
  }

  return rawResult;
}

// ── Public Services ──────────────────────────────────────────────────────────

export class KeyConceptsService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string,
    subjectId: string | null
  ): Promise<KeyConceptItem[]> {
    const storagePath = `${userId}/ai-gen-${documentId}/key-concepts.json`;
    const prompt = getPromptForKey('keyConcepts', extractedText, docTitle);

    const result = await runServiceWithCache<KeyConceptItem[]>(
      this.supabase,
      documentId,
      userId,
      'KeyConcepts',
      storagePath,
      prompt,
      validateKeyConcepts
    );

    // Sync to knowledge_graph database table (best-effort)
    if (subjectId) {
      try {
        const payload = result.map((item) => ({
          user_id: userId,
          subject_id: subjectId,
          concept: item.concept,
          description: item.definition + (item.example ? ` Example: ${item.example}` : ''),
          prerequisites: [],
          related_concepts: []
        }));

        const { error } = await this.supabase
          .from('knowledge_graph')
          .upsert(payload, { onConflict: 'subject_id,concept' });

        if (error) {
          logger.warn(`[KeyConceptsService] DB upsert to knowledge_graph failed: ${error.message}`);
        }
      } catch (dbErr) {
        logger.warn(`[KeyConceptsService] DB upsert bypass:`, dbErr);
      }
    }

    return result;
  }
}

export class DefinitionsService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string
  ): Promise<DefinitionItem[]> {
    const storagePath = `${userId}/ai-gen-${documentId}/definitions.json`;
    const prompt = getPromptForKey('definitions', extractedText, docTitle);

    return runServiceWithCache<DefinitionItem[]>(
      this.supabase,
      documentId,
      userId,
      'Definitions',
      storagePath,
      prompt,
      validateDefinitions
    );
  }
}

export class FlashcardsService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string,
    subjectId: string | null
  ): Promise<FlashcardItem[]> {
    const storagePath = `${userId}/ai-gen-${documentId}/flashcards.json`;
    const prompt = getPromptForKey('flashcards', extractedText, docTitle);

    const result = await runServiceWithCache<FlashcardItem[]>(
      this.supabase,
      documentId,
      userId,
      'Flashcards',
      storagePath,
      prompt,
      validateFlashcards
    );

    // Sync to flashcards database table
    try {
      // First clear old ones to prevent accumulation/duplicates
      await this.supabase
        .from('flashcards')
        .delete()
        .eq('document_id', documentId);

      const payload = result.map((fc) => ({
        user_id: userId,
        subject_id: subjectId,
        document_id: documentId,
        front_content: fc.front,
        back_content: fc.back
      }));

      const { error } = await this.supabase
        .from('flashcards')
        .insert(payload);

      if (error) {
        logger.warn(`[FlashcardsService] DB insert to flashcards failed: ${error.message}`);
      }
    } catch (dbErr) {
      logger.warn(`[FlashcardsService] DB insert bypass:`, dbErr);
    }

    return result;
  }
}

export class MCQService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string,
    subjectId: string | null
  ): Promise<MCQItem[]> {
    const storagePath = `${userId}/ai-gen-${documentId}/mcqs.json`;
    const prompt = getPromptForKey('mcqs', extractedText, docTitle);

    const result = await runServiceWithCache<MCQItem[]>(
      this.supabase,
      documentId,
      userId,
      'MCQs',
      storagePath,
      prompt,
      validateMCQs
    );

    // Sync to quizzes database table for compatibility
    try {
      await this.supabase
        .from('quizzes')
        .delete()
        .eq('document_id', documentId);

      const quizQuestions = result.map((item, idx) => ({
        id: `q_${idx + 1}`,
        type: 'mcq',
        questionText: item.question,
        options: item.options,
        correctAnswer: String(item.correctAnswer),
        explanation: item.explanation,
        difficulty: 'medium'
      }));

      const { error } = await this.supabase
        .from('quizzes')
        .insert({
          user_id: userId,
          document_id: documentId,
          subject_id: subjectId,
          title: `AI Quiz: ${docTitle.replace(/\.[^/.]+$/, "")}`,
          questions: quizQuestions,
          total_questions: quizQuestions.length,
          score: 0,
          status: 'not_started'
        });

      if (error) {
        logger.warn(`[MCQService] DB insert to quizzes failed: ${error.message}`);
      }
    } catch (dbErr) {
      logger.warn(`[MCQService] DB insert bypass:`, dbErr);
    }

    return result;
  }
}

export class PracticeQuestionsService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string
  ): Promise<PracticeQuestionsSet> {
    const storagePath = `${userId}/ai-gen-${documentId}/practice-questions.json`;
    const prompt = getPromptForKey('practiceQuestions', extractedText, docTitle);

    return runServiceWithCache<PracticeQuestionsSet>(
      this.supabase,
      documentId,
      userId,
      'PracticeQuestions',
      storagePath,
      prompt,
      validatePracticeQuestions
    );
  }
}
