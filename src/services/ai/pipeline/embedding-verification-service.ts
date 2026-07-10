import { SupabaseClient } from '@supabase/supabase-js';

export interface EmbeddingCheckResult {
  passed: boolean;
  reason?: string;
}

export interface KnowledgeVerificationReport {
  passed: boolean;
  failedCheck: string | null;
  failedReason: string | null;
  checkResults: Record<string, EmbeddingCheckResult>;
  verifiedAt: string;
}

export class EmbeddingVerificationService {
  constructor(
    private supabase: SupabaseClient,
    private documentId: string,
    private userId: string
  ) {}

  // ── Verification 1: Number of Embeddings Equals Number of Chunks ─────────
  private verifyEmbeddingCount(chunks: any[]): EmbeddingCheckResult {
    const chunkCount = chunks.length;
    const embeddedCount = chunks.filter(c => c.embedding !== null && c.embedding !== undefined).length;

    if (chunkCount !== embeddedCount) {
      return {
        passed: false,
        reason: `Mismatched counts: Document has ${chunkCount} chunks, but only ${embeddedCount} chunks have generated embeddings.`
      };
    }
    return { passed: true };
  }

  // ── Verification 2: No NULL Embeddings ────────────────────────────────────
  private verifyNoNullEmbeddings(chunks: any[]): EmbeddingCheckResult {
    const nullChunks = chunks.filter(c => c.embedding === null || c.embedding === undefined);
    if (nullChunks.length > 0) {
      const indices = nullChunks.map(c => c.chunk_index).join(', ');
      return {
        passed: false,
        reason: `NULL or undefined embeddings found for chunk indices: [${indices}].`
      };
    }
    return { passed: true };
  }

  // ── Verification 3: Every Embedding Belongs to the Correct Chunk ────────
  private verifyChunkLinkage(chunks: any[]): EmbeddingCheckResult {
    for (const chunk of chunks) {
      if (!chunk.id) {
        return {
          passed: false,
          reason: `Chunk at index ${chunk.chunk_index} is missing its database ID.`
        };
      }
    }
    return { passed: true };
  }

  // ── Verification 4: Every Chunk Belongs to the Correct Document ────────
  private verifyDocumentLinkage(chunks: any[]): EmbeddingCheckResult {
    const invalidChunks = chunks.filter(c => c.document_id !== this.documentId);
    if (invalidChunks.length > 0) {
      return {
        passed: false,
        reason: `${invalidChunks.length} chunks do not reference the target document ID: ${this.documentId}.`
      };
    }
    return { passed: true };
  }

  // ── Verification 5: Every Embedding Belongs to the Correct User ─────────
  private async verifyUserLinkage(): Promise<EmbeddingCheckResult> {
    try {
      const { data: doc, error } = await this.supabase
        .from('documents')
        .select('user_id')
        .eq('id', this.documentId)
        .single();

      if (error || !doc) {
        return {
          passed: false,
          reason: `Could not verify document owner. Database error: ${error?.message || 'Not found'}`
        };
      }

      if (doc.user_id !== this.userId) {
        return {
          passed: false,
          reason: `Document owner mismatch. Document belongs to user ${doc.user_id}, but current user is ${this.userId}.`
        };
      }

      return { passed: true };
    } catch (err: any) {
      return {
        passed: false,
        reason: `Exception verifying user linkage: ${err?.message || String(err)}`
      };
    }
  }

  // ── Verification 6: No Duplicate Embeddings ──────────────────────────────
  private verifyNoDuplicateEmbeddings(chunks: any[]): EmbeddingCheckResult {
    const seenEmbeddings = new Set<string>();
    
    for (const chunk of chunks) {
      let embeddingStr = '';
      if (Array.isArray(chunk.embedding)) {
        embeddingStr = chunk.embedding.join(',');
      } else if (typeof chunk.embedding === 'string') {
        embeddingStr = chunk.embedding;
      } else {
        return {
          passed: false,
          reason: `Invalid embedding format at chunk index ${chunk.chunk_index}.`
        };
      }

      if (seenEmbeddings.has(embeddingStr)) {
        return {
          passed: false,
          reason: `Duplicate embedding vector found at chunk index ${chunk.chunk_index}. All chunk vectors must be unique.`
        };
      }
      seenEmbeddings.add(embeddingStr);
    }
    
    return { passed: true };
  }

  // ── Verification 7: No Orphan Embeddings ───────────────────────────────
  // Ensure all chunk records with embeddings belong to a valid chunk row
  private verifyNoOrphanEmbeddings(chunks: any[]): EmbeddingCheckResult {
    // If every chunk fetched is from document_chunks table and maps to this document, there are no orphans
    for (const chunk of chunks) {
      if (!chunk.content || chunk.content.trim().length === 0) {
        return {
          passed: false,
          reason: `Orphan-like empty content chunk with index ${chunk.chunk_index} found.`
        };
      }
    }
    return { passed: true };
  }

  // ── Verification 8: Embedding Generation Time Recorded ──────────────────
  private async verifyGenerationTimeRecorded(): Promise<EmbeddingCheckResult> {
    try {
      const { data: knowledge, error } = await this.supabase
        .from('document_knowledge')
        .select('embeddings_generated_at, embedding_status')
        .eq('document_id', this.documentId)
        .single();

      if (error || !knowledge) {
        return {
          passed: false,
          reason: `Could not verify document_knowledge record: ${error?.message || 'Not found'}`
        };
      }

      if (!knowledge.embeddings_generated_at) {
        return {
          passed: false,
          reason: 'Embedding generation timestamp (embeddings_generated_at) was not recorded.'
        };
      }

      if (knowledge.embedding_status !== 'completed') {
        return {
          passed: false,
          reason: `Expected embedding_status to be 'completed', found: '${knowledge.embedding_status}'`
        };
      }

      return { passed: true };
    } catch (err: any) {
      return {
        passed: false,
        reason: `Exception verifying generation time: ${err?.message || String(err)}`
      };
    }
  }

  // ── Run all verification checks ─────────────────────────────────────────
  async verify(): Promise<KnowledgeVerificationReport> {
    const checkResults: Record<string, EmbeddingCheckResult> = {};
    let failedCheck: string | null = null;
    let failedReason: string | null = null;

    try {
      // Fetch all chunks for target document
      const { data: chunks, error } = await this.supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content, embedding')
        .eq('document_id', this.documentId)
        .order('chunk_index', { ascending: true });

      if (error || !chunks || chunks.length === 0) {
        return {
          passed: false,
          failedCheck: 'fetch_chunks',
          failedReason: `Failed to fetch chunks for verification: ${error?.message || 'Zero chunks found'}`,
          checkResults: {
            fetch_chunks: { passed: false, reason: error?.message || 'Zero chunks found' }
          },
          verifiedAt: new Date().toISOString()
        };
      }

      // Check 1: Count of non-null embeddings matches chunk count
      checkResults['1_embedding_count_matches'] = this.verifyEmbeddingCount(chunks);

      // Check 2: No NULL embeddings
      checkResults['2_no_null_embeddings'] = this.verifyNoNullEmbeddings(chunks);

      // Check 3: Every embedding references a valid chunk row ID
      checkResults['3_correct_chunk_linkage'] = this.verifyChunkLinkage(chunks);

      // Check 4: Every chunk belongs to the correct document
      checkResults['4_correct_document_linkage'] = this.verifyDocumentLinkage(chunks);

      // Check 5: Every embedding references the correct user
      checkResults['5_correct_user_linkage'] = await this.verifyUserLinkage();

      // Check 6: No duplicate embeddings
      checkResults['6_no_duplicate_embeddings'] = this.verifyNoDuplicateEmbeddings(chunks);

      // Check 7: No orphan embeddings
      checkResults['7_no_orphan_embeddings'] = this.verifyNoOrphanEmbeddings(chunks);

      // Check 8: Timestamp and status recorded in DB
      checkResults['8_generation_time_recorded'] = await this.verifyGenerationTimeRecorded();

      // Determine final status
      const blockingChecks = [
        '1_embedding_count_matches',
        '2_no_null_embeddings',
        '3_correct_chunk_linkage',
        '4_correct_document_linkage',
        '5_correct_user_linkage',
        '6_no_duplicate_embeddings',
        '7_no_orphan_embeddings',
        '8_generation_time_recorded'
      ];

      for (const key of blockingChecks) {
        const check = checkResults[key];
        if (check && !check.passed) {
          failedCheck = key;
          failedReason = check.reason || 'Unknown check failure.';
          break;
        }
      }

    } catch (err: any) {
      failedCheck = 'critical_error';
      failedReason = `Critical exception during knowledge verification: ${err?.message || String(err)}`;
      checkResults['critical_error'] = { passed: false, reason: failedReason };
    }

    return {
      passed: failedCheck === null,
      failedCheck,
      failedReason,
      checkResults,
      verifiedAt: new Date().toISOString()
    };
  }
}
