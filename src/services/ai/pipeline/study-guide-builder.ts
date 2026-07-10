import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export class StudyGuideBuilder {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    docTitle: string
  ): Promise<any> {
    logger.info(`[StudyGuideBuilder] Building unified study guide for: ${documentId}`);

    const baseDir = `${userId}/ai-gen-${documentId}`;
    const resources = [
      { key: 'summary',           fileName: 'summary.json' },
      { key: 'keyConcepts',       fileName: 'key-concepts.json' },
      { key: 'definitions',       fileName: 'definitions.json' },
      { key: 'flashcards',        fileName: 'flashcards.json' },
      { key: 'mcqs',              fileName: 'mcqs.json' },
      { key: 'practiceQuestions', fileName: 'practice-questions.json' },
    ];

    const guideContent: Record<string, any> = {
      documentId,
      docTitle,
      builtAt: new Date().toISOString(),
      summary: null,
      keyConcepts: null,
      definitions: null,
      flashcards: null,
      mcqs: null,
      practiceQuestions: null,
    };

    let availableCount = 0;

    for (const res of resources) {
      const storagePath = `${baseDir}/${res.fileName}`;
      try {
        const { data: fileData, error } = await this.supabase.storage
          .from('documents')
          .download(storagePath);

        if (error || !fileData) {
          logger.warn(`[StudyGuideBuilder] Resource ${res.key} not found or failed to load: ${error?.message || 'Empty'}`);
          continue;
        }

        const jsonText = await fileData.text();
        guideContent[res.key] = JSON.parse(jsonText);
        availableCount++;
      } catch (err: any) {
        logger.warn(`[StudyGuideBuilder] Failed to process ${res.key}: ${err.message}`);
      }
    }

    if (availableCount === 0) {
      throw new Error('Study Guide Builder failed: No individual structured resources were successfully found/loaded.');
    }

    // Save unified structured study guide to Storage
    const guidePath = `${baseDir}/study-guide.json`;
    const jsonBuf = Buffer.from(JSON.stringify(guideContent, null, 2));

    const { error: uploadErr } = await this.supabase.storage
      .from('documents')
      .upload(guidePath, jsonBuf, {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadErr) {
      throw new Error(`Failed to save study guide to storage: ${uploadErr.message}`);
    }

    logger.info(`[StudyGuideBuilder] Unified study guide built successfully with ${availableCount} resources`);
    return guideContent;
  }
}
