import { SearchResult, calculateConfidence } from '../search';
import { logger } from '@/lib/logger';
import { countTokens } from './tokenizer';
import { ContextBudgetManager } from './context-budget-manager';
import { ContextCompressor } from './context-compressor';
import { PipelineValidator } from './context-validator';
import * as fs from 'fs';
import * as path from 'path';

export interface ContextSource {
  documentId: string;
  documentTitle: string;
  chunkIndices: number[];
  maxSimilarity: number;
}

export interface ContextPackage {
  query: string;
  formattedContext: string;
  sources: ContextSource[];
  overallConfidenceScore: number;
  overallConfidenceLabel: 'Excellent Match' | 'Good Match' | 'Weak Match' | 'No Reliable Match';
  estimatedTokens: number;
  isTruncated?: boolean;
}

export class ContextBuilder {
  /**
   * Transforms raw chunks into a production-grade context package.
   * Leverages ContextBudgetManager for token-accurate decisions and ContextCompressor for cleanup.
   *
   * @param query The user's prompt or question
   * @param chunks Raw chunks retrieved from database or loader
   * @param maxTokens The target token budget (strict limit)
   */
  static build(
    query: string,
    chunks: SearchResult[],
    maxTokens = 3000
  ): ContextPackage {
    const startTimeMs = Date.now();
    logger.info(`[ContextBuilder] Building context for query (Budget: ${maxTokens} tokens)`);

    // ── Phase 8: Input validation ──
    PipelineValidator.validateChunking(chunks);

    const budgetManager = new ContextBudgetManager(maxTokens);
    const selectedChunks: SearchResult[] = [];
    let chunksSkipped = 0;

    // Stable sort by similarity descending to prioritize higher confidence matches.
    // For direct document summaries, all similarity values are 1.0, preserving index order.
    const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);

    // ── Phase 3: Evaluate chunks individually ──
    for (const chunk of sortedChunks) {
      const textToFit = chunk.content;
      
      const fitResult = budgetManager.fitAndAdd(textToFit);
      
      if (fitResult.accepted) {
        const chunkToAdd = fitResult.truncated
          ? { ...chunk, content: fitResult.text }
          : chunk;
          
        selectedChunks.push(chunkToAdd);
        
        if (fitResult.truncated) {
          logger.info(`[ContextBuilder] Chunk ${chunk.chunk_index} trimmed to fit remaining budget.`);
          break; // Remaining budget is exhausted.
        }
      } else {
        chunksSkipped++;
        logger.info(`[ContextBuilder] Chunk ${chunk.chunk_index} skipped. Reason: ${fitResult.reason}`);
      }
    }

    // Sort selected chunks back to logical order: group by document name, and then indices ascending
    selectedChunks.sort((a, b) => {
      const docA = a.document_title || 'Untitled';
      const docB = b.document_title || 'Untitled';
      const titleCompare = docA.localeCompare(docB);
      if (titleCompare !== 0) return titleCompare;
      return a.chunk_index - b.chunk_index;
    });

    // Assemble final formatted context
    let formattedContext = '';
    const sourcesMap = new Map<string, { documentId: string; documentTitle: string; chunkIndices: number[]; maxSimilarity: number }>();

    for (const chunk of selectedChunks) {
      const docId = chunk.document_id;
      const title = chunk.document_title || 'Untitled Document';
      
      if (!sourcesMap.has(docId)) {
        sourcesMap.set(docId, {
          documentId: docId,
          documentTitle: title,
          chunkIndices: [],
          maxSimilarity: 0
        });
      }
      
      const source = sourcesMap.get(docId)!;
      source.chunkIndices.push(chunk.chunk_index);
      if (chunk.similarity > source.maxSimilarity) {
        source.maxSimilarity = chunk.similarity;
      }

      formattedContext += `=== Source: "${title}" | Chunk: ${chunk.chunk_index} ===\n${chunk.content}\n\n`;
    }

    formattedContext = formattedContext.trim();

    // ── Phase 7: Context Compression ──
    const primaryDocTitle = chunks[0]?.document_title;
    formattedContext = ContextCompressor.compress(formattedContext, primaryDocTitle);

    // ── Phase 1: Bulletproof truncation warning ──
    const report = budgetManager.getReport();
    if (report.isTruncated) {
      formattedContext = `[WARNING: Document truncated because it exceeded the maximum context budget of ${maxTokens} tokens.]\n\n` + formattedContext;
    }

    // Calculate final metrics
    const finalTokens = countTokens(formattedContext);
    const highestScore = chunks.length > 0 ? Math.max(...chunks.map(c => c.similarity)) : 0.00;
    const confidence = calculateConfidence(highestScore);

    const contextPackage: ContextPackage = {
      query,
      formattedContext: formattedContext || 'No relevant document context found.',
      sources: Array.from(sourcesMap.values()),
      overallConfidenceScore: confidence.score,
      overallConfidenceLabel: confidence.label,
      estimatedTokens: finalTokens,
      isTruncated: report.isTruncated
    };

    // ── Phase 8: Output validation ──
    PipelineValidator.validateContext(contextPackage.formattedContext);

    // ── Phase 9: Debug & Monitoring logging ──
    const durationMs = Date.now() - startTimeMs;
    this.logBuildToDisk(
      contextPackage,
      chunks.length,
      selectedChunks.length,
      chunksSkipped,
      report,
      durationMs
    );

    return contextPackage;
  }

  private static logBuildToDisk(
    pkg: ContextPackage,
    received: number,
    selected: number,
    skipped: number,
    report: any,
    durationMs: number
  ) {
    try {
      const ts = new Date().toISOString();
      const docId = pkg.sources[0]?.documentId || 'unknown-doc';
      const logMsg = `[${ts}] [ContextBuilder] Document ID: ${docId} | Chunks Received: ${received} | Chunks Selected: ${selected} | Chunks Skipped: ${skipped} | Est Tokens: ${pkg.estimatedTokens}/${report.maxTokens} | Truncated: ${pkg.isTruncated} | Duration: ${durationMs}ms\n`;
      fs.appendFileSync(path.join(process.cwd(), 'background_logs.txt'), logMsg);
    } catch { /* ignore */ }
  }
}
