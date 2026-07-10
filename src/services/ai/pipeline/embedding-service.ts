import { SupabaseClient } from '@supabase/supabase-js';
import { getEmbeddings } from '../embeddings';
import { logger } from '@/lib/logger';

export interface EmbeddingGenerationResult {
  success: boolean;
  totalChunks: number;
  embeddingsGenerated: number;
  skipped: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export class EmbeddingService {
  constructor(
    private supabase: SupabaseClient,
    private logFn: (stage: string, message: string, level?: 'INFO' | 'WARN' | 'ERROR') => void
  ) {}

  /**
   * Generates and stores 1536-dimensional embeddings for all chunks of a document.
   */
  async generateForDocument(
    documentId: string,
    userId: string,
    forceRun = false
  ): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();
    this.logFn('embeddings', 'Embedding Generation stage initiated', 'INFO');

    try {
      // 1. Fetch all chunks for this document
      const { data: chunks, error: fetchErr } = await this.supabase
        .from('document_chunks')
        .select('id, chunk_index, content, embedding')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (fetchErr) {
        throw new Error(`Failed to fetch document chunks for embedding: ${fetchErr.message}`);
      }

      if (!chunks || chunks.length === 0) {
        throw new Error('No chunks found for this document. Chunks must be generated before embeddings.');
      }

      const totalChunks = chunks.length;
      this.logFn('embeddings', `Chunks Found: ${totalChunks}`, 'INFO');

      // 2. Check if embeddings are already present (Idempotency check)
      const missingEmbeddings = chunks.filter(c => !c.embedding);
      const isComplete = missingEmbeddings.length === 0;

      if (isComplete && !forceRun) {
        this.logFn('embeddings', `All ${totalChunks} chunks already have valid embeddings. Skipping regeneration (idempotency).`, 'INFO');
        
        await this.supabase
          .from('document_knowledge')
          .update({
            embedding_status: 'completed',
            embedding_count: totalChunks,
            embeddings_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);

        return {
          success: true,
          totalChunks,
          embeddingsGenerated: 0,
          skipped: true,
          durationMs: Date.now() - startTime
        };
      }

      this.logFn('embeddings', `Generating embeddings for ${forceRun ? totalChunks : missingEmbeddings.length} chunks...`, 'INFO');

      // 3. Update database status to 'generating'
      await this.supabase
        .from('document_knowledge')
        .update({
          embedding_status: 'generating',
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      // 4. Batch generation process (batch size of 50 is conservative and safe for API quotas)
      const batchSize = 50;
      const chunksToProcess = forceRun ? chunks : missingEmbeddings;
      const updatedChunksPayload: any[] = [];

      for (let i = 0; i < chunksToProcess.length; i += batchSize) {
        const batch = chunksToProcess.slice(i, i + batchSize);
        const batchTexts = batch.map(c => c.content);

        this.logFn('embeddings', `Generating batch of embeddings ${i + 1} to ${Math.min(i + batchSize, chunksToProcess.length)} of ${chunksToProcess.length}...`, 'INFO');
        
        // Log individual chunk progress tracking requested in Phase 2
        for (let j = 0; j < batch.length; j++) {
          const globalIndex = i + j + 1;
          this.logFn('embeddings', `Generating Embedding ${globalIndex}/${chunksToProcess.length}`, 'INFO');
        }

        const vectors = await getEmbeddings(batchTexts);

        if (!vectors || vectors.length !== batch.length) {
          throw new Error(`Embedding API returned mismatched vectors. Expected ${batch.length}, got ${vectors?.length || 0}`);
        }

        // Map vectors back to their chunk payload
        batch.forEach((chunk, index) => {
          const vector = vectors[index];
          if (!vector || vector.length !== 1536) {
            throw new Error(`Embedding generation failed: Chunk index ${chunk.chunk_index} received an invalid or null vector.`);
          }

          updatedChunksPayload.push({
            id: chunk.id,
            document_id: documentId,
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            embedding: vector
          });
        });
      }

      // 5. Store embeddings back into database (bulk upsert on primary key 'id')
      this.logFn('embeddings', `Storing ${updatedChunksPayload.length} embeddings in database...`, 'INFO');
      
      const { error: upsertErr } = await this.supabase
        .from('document_chunks')
        .upsert(updatedChunksPayload, { onConflict: 'id' });

      if (upsertErr) {
        throw new Error(`Failed to save embeddings to database: ${upsertErr.message}`);
      }

      this.logFn('embeddings', `All ${updatedChunksPayload.length} embeddings stored successfully.`, 'INFO');

      // 6. Update document_knowledge meta tracking
      await this.supabase
        .from('document_knowledge')
        .update({
          embedding_status: 'completed',
          embedding_count: totalChunks,
          embeddings_generated_at: new Date().toISOString(),
          embedding_error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      return {
        success: true,
        totalChunks,
        embeddingsGenerated: updatedChunksPayload.length,
        skipped: false,
        durationMs: Date.now() - startTime
      };

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logFn('embeddings', `Embedding Generation Failed: ${errMsg}`, 'ERROR');

      // Record error on the document_knowledge record
      try {
        await this.supabase
          .from('document_knowledge')
          .update({
            embedding_status: 'failed',
            embedding_error_message: errMsg,
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);
      } catch (dbErr) {
        logger.error('Failed to log embedding error to database:', dbErr);
      }

      return {
        success: false,
        totalChunks: 0,
        embeddingsGenerated: 0,
        skipped: false,
        errorMessage: errMsg,
        durationMs: Date.now() - startTime
      };
    }
  }
}
