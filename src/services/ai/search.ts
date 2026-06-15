import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from './embeddings';
import { logger } from '@/lib/logger';

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
}

/**
 * Searches document chunks using vector similarity.
 * First attempts to run the match_document_chunks RPC in Supabase.
 * If the RPC fails or is missing, falls back to an in-memory JS cosine similarity search.
 */
export async function searchChunks(
  userId: string,
  query: string,
  documentIds?: string[] | null,
  limit: number = 5,
  matchThreshold: number = 0.2
): Promise<SearchResult[]> {
  try {
    const queryEmbedding = await getEmbedding(query);
    const supabase = await createClient();

    logger.info(`[Search] Performing vector search for query: "${query}" (limit: ${limit})`);

    // Attempt RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: limit,
      filter_document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
      filter_user_id: userId
    });

    if (!rpcError && rpcData) {
      logger.info(`[Search] DB RPC vector search matched ${rpcData.length} chunks.`);
      
      const matches = (rpcData as unknown as RpcSearchResult[]) || [];
      const docIds = Array.from(new Set(matches.map((r) => r.document_id)));
      if (docIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title')
          .in('id', docIds)
          .is('deleted_at', null);
        
        const docMap = new Map(docs?.map(d => [d.id, d.title]) || []);
        const activeRpcData = matches.filter((r) => docMap.has(r.document_id));

        return activeRpcData.map((r) => ({
          id: r.id,
          document_id: r.document_id,
          chunk_index: r.chunk_index,
          content: r.content,
          similarity: r.similarity,
          document_title: docMap.get(r.document_id) || 'Untitled Document'
        }));
      }
      return matches.map((r) => ({ ...r, document_title: 'Untitled Document' }));
    }

    logger.warn(`[Search] RPC failed or missing: ${rpcError?.message || 'Unknown error'}. Falling back to in-memory cosine similarity.`);

    // Fallback: in-memory cosine similarity
    // Fetch chunks along with user/document filters
    let queryBuilder = supabase
      .from('document_chunks')
      .select(`
        id,
        document_id,
        chunk_index,
        content,
        embedding,
        documents!inner (
          id,
          user_id,
          title,
          deleted_at
        )
      `)
      .is('documents.deleted_at', null);

    if (userId) {
      queryBuilder = queryBuilder.eq('documents.user_id', userId);
    }
    if (documentIds && documentIds.length > 0) {
      queryBuilder = queryBuilder.in('document_id', documentIds);
    }

    const { data: chunks, error: fetchError } = await queryBuilder;

    if (fetchError || !chunks) {
      logger.error(`[Search] Fallback fetch failed: ${fetchError?.message}`);
      return [];
    }

    logger.info(`[Search] Fallback fetched ${chunks.length} chunks for in-memory cosine similarity calculation.`);

    // Helper for cosine similarity
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

    // Calculate similarities
    const results: SearchResult[] = [];
    for (const chunk of chunks) {
      let chunkEmb: number[] | null = null;
      if (chunk.embedding) {
        if (typeof chunk.embedding === 'string') {
          try {
            const cleaned = chunk.embedding.replace(/[\[\]]/g, '');
            chunkEmb = cleaned.split(',').map(Number);
          } catch (e) {
            logger.error(`[Search] Failed to parse embedding string for chunk ${chunk.id}`, e);
          }
        } else if (Array.isArray(chunk.embedding)) {
          chunkEmb = chunk.embedding;
        }
      }

      if (!chunkEmb || chunkEmb.length !== queryEmbedding.length) {
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, chunkEmb);
      if (similarity >= matchThreshold) {
        const docInfo = Array.isArray(chunk.documents)
          ? (chunk.documents[0] as unknown as DocumentRelation)
          : (chunk.documents as unknown as DocumentRelation);
        results.push({
          id: chunk.id,
          document_id: chunk.document_id,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          similarity: similarity,
          document_title: docInfo?.title || 'Untitled Document'
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const finalResults = results.slice(0, limit);
    logger.info(`[Search] Fallback returned ${finalResults.length} matches.`);
    return finalResults;

  } catch (error) {
    logger.error('[Search] Critical search failure:', error);
    return [];
  }
}
