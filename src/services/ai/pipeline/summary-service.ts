import { SupabaseClient } from '@supabase/supabase-js';
import { generateWithBackoff } from '../background-generator';
import { getPromptForKey } from '../study-pack-generator';
import { getEmbedding } from '../embeddings';
import { StudySummary } from './types';
import { logger } from '@/lib/logger';

export interface SummaryResult {
  success: boolean;
  content: StudySummary | null;
  errorMessage?: string;
}

function validateSummary(data: any): data is StudySummary {
  return (
    data &&
    Array.isArray(data.learningObjectives) &&
    typeof data.overview === 'string' &&
    Array.isArray(data.keyConceptsList) &&
    Array.isArray(data.keyTakeaways)
  );
}

export class SummaryGenerationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async run(
    documentId: string,
    userId: string,
    extractedText: string,
    docTitle: string
  ): Promise<SummaryResult> {
    logger.info(`[SummaryService] Starting summary generation for document: ${documentId}`);
    const storagePath = `${userId}/ai-gen-${documentId}/summary.json`;

    try {
      // 1. Check if structured summary already exists in storage
      const { data: existingFileData, error: checkErr } = await this.supabase.storage
        .from('documents')
        .download(storagePath);

      if (!checkErr && existingFileData) {
        logger.info(`[SummaryService] Structured summary JSON already exists in storage. Reusing...`);
        const jsonText = await existingFileData.text();
        const parsed = JSON.parse(jsonText);
        if (validateSummary(parsed)) {
          return { success: true, content: parsed };
        }
      }

      // 2. Build prompt and generate summary via Gemini direct call
      const prompt = getPromptForKey('summary', extractedText, docTitle);
      const rawResult = await generateWithBackoff(
        `${documentId.substring(0, 8)}-summary`,
        prompt,
        3
      );

      // 3. Validate structured output
      if (!validateSummary(rawResult)) {
        throw new Error('Summary output validation failed. Required keys (learningObjectives, overview, keyConceptsList, keyTakeaways) are missing or invalid.');
      }

      // 4. Save structured JSON to Supabase Storage
      const jsonBuf = Buffer.from(JSON.stringify(rawResult, null, 2));
      const { error: uploadErr } = await this.supabase.storage
        .from('documents')
        .upload(storagePath, jsonBuf, {
          contentType: 'application/json',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        logger.warn(`[SummaryService] Warning: Failed to save JSON file to storage: ${uploadErr.message}`);
      } else {
        logger.info(`[SummaryService] Structured JSON saved to storage at: ${storagePath}`);
      }

      // 5. Save structured summary in database `ai_summaries` table for UI views
      // First clean up any existing summary to prevent key/constraint issues
      await this.supabase
        .from('ai_summaries')
        .delete()
        .eq('document_id', documentId);

      // Generate embedding if possible, fallback to null
      let embedding: number[] | null = null;
      try {
        embedding = await getEmbedding(rawResult.overview);
      } catch (embErr) {
        logger.warn(`[SummaryService] Embedding generation bypassed/failed:`, embErr);
      }

      const { error: dbErr } = await this.supabase
        .from('ai_summaries')
        .insert({
          document_id: documentId,
          summary_text: `<!-- MODE: detailed -->\n\n${rawResult.overview}`,
          key_points: rawResult.keyTakeaways,
          embedding: embedding
        });

      if (dbErr) {
        logger.error(`[SummaryService] Error saving summary to database table: ${dbErr.message}`);
      }

      // 6. Notify user of Summary Completion
      const notificationMessage = `Your AI study summary for "${docTitle}" is ready! You can now view and study it.`;
      const { error: notifErr } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: 'Study Summary Ready',
          message: notificationMessage,
          type: 'system',
          is_read: false
        });

      if (notifErr) {
        logger.warn(`[SummaryService] Warning: Notification insert failed: ${notifErr.message}`);
      }

      logger.info(`[SummaryService] Summary generated and saved successfully.`);
      return { success: true, content: rawResult };

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[SummaryService] Summary generation failed: ${msg}`);
      return {
        success: false,
        content: null,
        errorMessage: msg
      };
    }
  }
}
