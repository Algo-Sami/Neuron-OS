import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from './embeddings';
import { logger } from '@/lib/logger';
import * as fs from 'fs';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RpcSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

interface DocumentRelation {
  id: string;
  user_id: string;
  title: string;
  deleted_at: string | null;
}

export interface SearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  document_title?: string;
  confidence_score?: number;
  confidence_label?: string;
}

export interface RetrievalResponse {
  success: boolean;
  message?: string; // e.g., "No reliable knowledge found."
  chunks: SearchResult[];
  confidenceScore: number;
  confidenceLabel: 'Excellent Match' | 'Good Match' | 'Weak Match' | 'No Reliable Match';
  durationMs: number;
}

// ── Helper functions for Confidence Score ───────────────────────────────────

export function calculateConfidence(score: number): {
  score: number;
  label: 'Excellent Match' | 'Good Match' | 'Weak Match' | 'No Reliable Match';
} {
  const rounded = Math.round(score * 100) / 100;
  if (rounded >= 0.90) return { score: rounded, label: 'Excellent Match' };
  if (rounded >= 0.75) return { score: rounded, label: 'Good Match' };
  if (rounded >= 0.50) return { score: rounded, label: 'Weak Match' };
  return { score: rounded, label: 'No Reliable Match' };
}

// Disk logging for debugging retrieval quality
function logRetrievalToDisk(data: {
  question: string;
  searchedDocCount: number;
  chunksEvaluatedCount: number;
  selectedCount: number;
  confidenceScore: number;
  confidenceLabel: string;
  durationMs: number;
  scores: number[];
}) {
  try {
    const ts = new Date().toISOString();
    const logMsg = `[${ts}] [RAG Retrieval] Question: "${data.question}" | Docs: ${data.searchedDocCount} | Evaluated: ${data.chunksEvaluatedCount} | Selected: ${data.selectedCount} | Score: ${data.confidenceScore} (${data.confidenceLabel}) | Duration: ${data.durationMs}ms | All Scores: [${data.scores.join(', ')}]\n`;
    fs.appendFileSync('d:/FYP Project/neuron/background_logs.txt', logMsg);
  } catch { /* ignore */ }
}

// ── Search Chunks Engine ──────────────────────────────────────────────────────

/**
 * Core vector search engine.
 * Scopes query results strictly to Knowledge Ready, non-deleted documents matching userId.
 */
export async function searchChunks(
  userId: string,
  query: string,
  documentIds?: string[] | null,
  limit: number = 5,
  matchThreshold: number = 0.50, // Default threshold to 0.50 to enforce "No Hallucination"
  subjectId?: string | null
): Promise<SearchResult[]> {
  const startTimeMs = Date.now();

  // Step 1: Validate Query
  if (!query || query.trim().length === 0) {
    logger.warn('[Retrieval] Query validation failed: Empty query string.');
    return [];
  }

  try {
    // Step 2: Generate Query Embedding
    const queryEmbedding = await getEmbedding(query);
    const supabase = await createClient();

    // Step 3: Fetch active "Knowledge Ready" documents belonging to this user
    let docsQuery = supabase
      .from('documents')
      .select('id, title, subject_id, document_knowledge!inner(current_processing_stage)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('document_knowledge.current_processing_stage', 'Knowledge Ready');

    // Apply document filters if provided
    if (documentIds && documentIds.length > 0) {
      docsQuery = docsQuery.in('id', documentIds);
    }

    // Apply subject_id filter if provided
    if (subjectId) {
      docsQuery = docsQuery.eq('subject_id', subjectId);
    }

    const { data: validDocs, error: docsErr } = await docsQuery;

    if (docsErr) {
      logger.error(`[Retrieval] Failed to fetch valid documents: ${docsErr.message}`);
      return [];
    }

    if (!validDocs || validDocs.length === 0) {
      logger.info('[Retrieval] No valid "Knowledge Ready" documents found matching criteria. Returning empty results.');
      logRetrievalToDisk({
        question: query,
        searchedDocCount: 0,
        chunksEvaluatedCount: 0,
        selectedCount: 0,
        confidenceScore: 0.00,
        confidenceLabel: 'No Reliable Match',
        durationMs: Date.now() - startTimeMs,
        scores: []
      });
      return [];
    }

    const validDocIds = validDocs.map(d => d.id);
    const docMap = new Map(validDocs.map(d => [d.id, d.title]));

    logger.info(`[Retrieval] Scoped search to ${validDocIds.length} valid active documents.`);

    let rawMatches: SearchResult[] = [];

    // Attempt RPC similarity match
    const { data: rpcData, error: rpcError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.0, // Get all above 0.0 to perform post-filtering/thresholding
      match_count: limit * 4, // Fetch larger candidate pool for diversity filtering
      filter_document_ids: validDocIds,
      filter_user_id: userId
    });

    if (!rpcError && rpcData) {
      logger.info(`[Retrieval] DB RPC similarity match completed. Candidates: ${rpcData.length}`);
      const matches = rpcData as RpcSearchResult[];
      rawMatches = matches.map(r => ({
        id: r.id,
        document_id: r.document_id,
        chunk_index: r.chunk_index,
        content: r.content,
        similarity: r.similarity,
        document_title: docMap.get(r.document_id) || 'Untitled Document'
      }));
    } else {
      logger.warn(`[Retrieval] RPC search failed: ${rpcError?.message || 'Unknown'}. Falling back to in-memory cosine search.`);

      // Fallback in-memory search scoped only to the valid document IDs
      const { data: chunks, error: chunksErr } = await supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content, embedding')
        .in('document_id', validDocIds);

      if (chunksErr || !chunks) {
        logger.error(`[Retrieval] In-memory fallback chunks fetch failed: ${chunksErr?.message}`);
        return [];
      }

      logger.info(`[Retrieval] Fallback fetched ${chunks.length} candidate chunks for cosine matching.`);

      const cosineSimilarity = (a: number[], b: number[]): number => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      for (const chunk of chunks) {
        let chunkEmb: number[] | null = null;
        if (chunk.embedding) {
          if (typeof chunk.embedding === 'string') {
            try {
              chunkEmb = chunk.embedding.replace(/[\[\]]/g, '').split(',').map(Number);
            } catch (e) {
              logger.error(`[Retrieval] Cosine parser failed for chunk: ${chunk.id}`, e);
            }
          } else if (Array.isArray(chunk.embedding)) {
            chunkEmb = chunk.embedding;
          }
        }

        if (chunkEmb && chunkEmb.length === queryEmbedding.length) {
          const similarity = cosineSimilarity(queryEmbedding, chunkEmb);
          rawMatches.push({
            id: chunk.id,
            document_id: chunk.document_id,
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            similarity,
            document_title: docMap.get(chunk.document_id) || 'Untitled Document'
          });
        }
      }

      // Sort by similarity descending
      rawMatches.sort((a, b) => b.similarity - a.similarity);
    }

    // Step 4 & 7: Confidence score threshold filtering (No Hallucination Rule)
    // Filter matching chunks against matchThreshold
    const filteredMatches = rawMatches.filter(m => m.similarity >= matchThreshold);

    if (filteredMatches.length === 0) {
      logger.info(`[Retrieval] Highest candidate score is below match threshold (${matchThreshold}). Returning zero matches to prevent hallucination.`);
      logRetrievalToDisk({
        question: query,
        searchedDocCount: validDocIds.length,
        chunksEvaluatedCount: rawMatches.length,
        selectedCount: 0,
        confidenceScore: rawMatches[0]?.similarity || 0.00,
        confidenceLabel: 'No Reliable Match',
        durationMs: Date.now() - startTimeMs,
        scores: rawMatches.map(m => m.similarity)
      });
      return [];
    }

    // Step 5: Context Diversity selection
    // Run a two-pass algorithm to select high-relevance chunks from non-adjacent ranges
    const selectedChunks: SearchResult[] = [];
    const docSelectionIndices = new Map<string, Set<number>>();

    // Pass 1: Select chunks that are NOT immediately adjacent to any already-selected chunk from the same document
    for (const match of filteredMatches) {
      if (selectedChunks.length >= limit) break;

      const docId = match.document_id;
      const idx = match.chunk_index;

      if (!docSelectionIndices.has(docId)) {
        docSelectionIndices.set(docId, new Set());
      }
      const chosenIndices = docSelectionIndices.get(docId)!;

      // Check if adjacent (index difference is 1 or less)
      const hasAdjacent = Array.from(chosenIndices).some(existingIdx => Math.abs(existingIdx - idx) <= 1);

      if (!hasAdjacent) {
        chosenIndices.add(idx);
        const confidence = calculateConfidence(match.similarity);
        selectedChunks.push({
          ...match,
          confidence_score: confidence.score,
          confidence_label: confidence.label
        });
      }
    }

    // Pass 2: If we still have empty slots, fill them with remaining chunks (which might be adjacent) in similarity order
    if (selectedChunks.length < limit) {
      for (const match of filteredMatches) {
        if (selectedChunks.length >= limit) break;

        const docId = match.document_id;
        const idx = match.chunk_index;

        const chosenIndices = docSelectionIndices.get(docId)!;

        // Skip chunks we already added
        if (chosenIndices.has(idx)) continue;

        chosenIndices.add(idx);
        const confidence = calculateConfidence(match.similarity);
        selectedChunks.push({
          ...match,
          confidence_score: confidence.score,
          confidence_label: confidence.label
        });
      }
    }

    const topScore = selectedChunks[0]?.similarity || 0.00;
    const confidence = calculateConfidence(topScore);
    const durationMs = Date.now() - startTimeMs;

    // Step 9: Diagnostic Disk Logging
    logRetrievalToDisk({
      question: query,
      searchedDocCount: validDocIds.length,
      chunksEvaluatedCount: rawMatches.length,
      selectedCount: selectedChunks.length,
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      durationMs,
      scores: selectedChunks.map(m => m.similarity)
    });

    return selectedChunks;

  } catch (error) {
    logger.error('[Retrieval] Critical search failure:', error);
    return [];
  }
}

// ── Reusable Retrieve Knowledge Service ──────────────────────────────────────

/**
 * Reusable production-grade knowledge retrieval service.
 * Used by all downstream AI features.
 */
export async function retrieveKnowledge(
  question: string,
  userId: string,
  workspaceId?: string | null, // Accepted for compatibility, ignored if no workspace DB schema exists
  subjectId?: string | null,
  limit: number = 5,
  matchThreshold: number = 0.50
): Promise<RetrievalResponse> {
  const startTimeMs = Date.now();

  // Validate Question
  if (!question || question.trim().length === 0) {
    return {
      success: false,
      message: 'Question query validation failed: Question is empty.',
      chunks: [],
      confidenceScore: 0.00,
      confidenceLabel: 'No Reliable Match',
      durationMs: Date.now() - startTimeMs
    };
  }

  // Retrieve chunks using standard query logic (with subject filter)
  const chunks = await searchChunks(userId, question, null, limit, matchThreshold, subjectId);

  const durationMs = Date.now() - startTimeMs;

  if (chunks.length === 0) {
    return {
      success: false,
      message: 'No reliable knowledge found.',
      chunks: [],
      confidenceScore: 0.00,
      confidenceLabel: 'No Reliable Match',
      durationMs
    };
  }

  const topScore = chunks[0].similarity;
  const confidence = calculateConfidence(topScore);

  return {
    success: true,
    chunks,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    durationMs
  };
}
