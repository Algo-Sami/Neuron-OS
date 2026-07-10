import { logger } from '@/lib/logger';

export class PipelineValidator {
  static validateExtraction(text: string): void {
    if (!text || text.trim().length === 0) {
      const err = 'Document contains no readable text.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }

  static validateChunking(chunks: any[]): void {
    if (!chunks || chunks.length === 0) {
      const err = 'Chunk selection failed: No chunks generated.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const content = typeof chunk === 'string' ? chunk : chunk?.content;
      if (!content || content.trim().length === 0) {
        const err = `Chunk selection failed: Chunk at index ${i} is empty.`;
        logger.error(`[Validator] ${err}`);
        throw new Error(err);
      }
    }
  }

  static validateEmbeddings(chunksCount: number, embeddingsCount: number): void {
    if (chunksCount !== embeddingsCount) {
      const err = `Embedding validation mismatch: Chunk count [${chunksCount}] does not match embeddings count [${embeddingsCount}].`;
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }

  static validateContext(formattedContext: string): void {
    const trimmed = (formattedContext || '').trim();
    if (!trimmed || trimmed === 'No relevant document context found.') {
      const err = 'Summary generation aborted because no valid context was produced.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
    if (trimmed.length < 50) {
      const err = 'Summary generation aborted because context is too brief or trivial.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }

  static validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      const err = 'Prompt Builder validation failed: constructed prompt is empty.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }

  static validateAIResponse(response: string): void {
    if (!response || response.trim().length === 0) {
      const err = 'AI Response validation failed: model returned empty text.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }

  static validateSummary(summaryText: string): void {
    if (!summaryText || summaryText.trim().length < 100) {
      const err = 'Summary validation failed: result is empty or too short.';
      logger.error(`[Validator] ${err}`);
      throw new Error(err);
    }
  }
}
