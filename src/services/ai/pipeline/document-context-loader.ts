/**
 * DocumentContextLoader
 *
 * Loads ALL chunks belonging to a specific document directly from the database.
 *
 * This is the correct data source for AI-generated document resources
 * (Summary, Key Points, Definitions, Flashcards, Quizzes, Revision Notes, etc.).
 *
 * NEVER use vector search / retrieveKnowledge() for these features.
 * The documentId is already known — there is no search problem to solve.
 *
 * Architecture separation:
 *   ┌─ Document Processing Pipeline ──────────────────────────────────┐
 *   │  DocumentContextLoader  →  ContextBuilder  →  ResponseEngine   │
 *   │  (direct DB read, no embeddings, no similarity, no threshold)   │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *   ┌─ Knowledge Retrieval Pipeline ──────────────────────────────────┐
 *   │  searchChunks()  →  ContextBuilder  →  ResponseEngine          │
 *   │  (vector similarity search — for Chat, Q&A, Study Coach)       │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Returns SearchResult[] — identical type consumed by ContextBuilder.build().
 * Sets similarity = 1.0 on all chunks (full confidence, no ranking needed).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SearchResult } from '@/services/ai/search';
import { logger } from '@/lib/logger';

export interface DocumentContextLoaderInput {
  documentId: string;
  userId:     string;
  supabase:   SupabaseClient;
}

export class DocumentContextLoader {
  /**
   * Loads every chunk for `documentId` ordered by chunk_index ASC (reading order).
   * Returns them as SearchResult[] so ContextBuilder.build() can consume them unchanged.
   *
   * Throws if:
   *  - The document does not exist or does not belong to the user
   *  - The document is soft-deleted
   *  - No chunks are found (document was not properly chunked)
   */
  static async load(input: DocumentContextLoaderInput): Promise<SearchResult[]> {
    const { documentId, userId, supabase } = input;

    logger.info(`[DocumentContextLoader] Loading chunks for document: ${documentId}`);

    // ── 1. Verify document ownership & existence ──────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, title, deleted_at')
      .eq('id', documentId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (docErr) {
      throw new Error(`[DocumentContextLoader] Failed to verify document: ${docErr.message}`);
    }

    if (!doc) {
      throw new Error(`[DocumentContextLoader] Document [${documentId}] not found or access denied.`);
    }

    const documentTitle = (doc.title as string) || 'Untitled Document';

    // ── 2. Load all chunks in reading order ───────────────────────────────────
    const { data: chunks, error: chunkErr } = await supabase
      .from('document_chunks')
      .select('id, chunk_index, content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunkErr) {
      throw new Error(`[DocumentContextLoader] Failed to load chunks: ${chunkErr.message}`);
    }

    if (!chunks || chunks.length === 0) {
      throw new Error(`[DocumentContextLoader] No chunks found for document [${documentId}]. Ensure chunking has completed before generating resources.`);
    }

    logger.info(`[DocumentContextLoader] Loaded ${chunks.length} chunks for "${documentTitle}" (reading order)`);

    // ── 3. Map to SearchResult[] ──────────────────────────────────────────────
    // similarity = 1.0 → ContextBuilder treats all chunks as maximum-confidence content.
    // Token budget still applies — ContextBuilder will gracefully trim if needed.
    const results: SearchResult[] = chunks.map((chunk: {
      id: string;
      chunk_index: number;
      content: string;
    }) => ({
      id:               chunk.id,
      document_id:      documentId,
      chunk_index:      chunk.chunk_index,
      content:          chunk.content,
      similarity:       1.0,
      document_title:   documentTitle,
      confidence_score: 1.0,
      confidence_label: 'Excellent Match',
    }));

    return results;
  }
}
