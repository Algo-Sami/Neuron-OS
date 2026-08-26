/**
 * SummarySkillService — Phase 7 + Phase 8 Integration
 *
 * This service is the ONLY entry point for generating summaries.
 * It drives the complete AI pipeline.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ContextBuilder } from './context-builder';
import { UniversalAIResponseEngine } from './response-engine';
import { KnowledgeAssetRegistry } from './knowledge-asset-registry';
import { AssetGenerationManager } from './asset-generation-manager';
import { DocumentContextLoader } from './document-context-loader';
import { getEmbedding } from '../embeddings';
import { logger } from '@/lib/logger';
import { SearchResult } from '../search';
import { PipelineValidator } from './context-validator';
import { SlidingWindowSummarizer } from './sliding-window-summarizer';
import { CURRENT_PROMPT_VERSION } from './ai-version-manifest';

export type SummaryMode =
  | 'beginner'
  | 'concise'
  | 'detailed'
  | 'exam-focused'
  | 'bullet'
  | 'key-concepts';

export interface SummarySkillInput {
  documentId: string;
  userId: string;
  mode: SummaryMode;
  forceRegenerate?: boolean;
  supabase: SupabaseClient;
}

export interface SummarySkillOutput {
  success: boolean;
  summary?: string;
  keyPoints?: string[];
  createdAt?: string;
  cached?: boolean;
  errorMessage?: string;
  retrievalChunks?: number;
  confidenceScore?: number;
  confidenceLabel?: string;
  sourcesUsed?: string[];
  assetId?: string;
  assetVersion?: number;
}

export class SummarySkillService {
  static async run(input: SummarySkillInput): Promise<SummarySkillOutput> {
    const { documentId, userId, mode, forceRegenerate = false, supabase } = input;
    const modeTag = `<!-- MODE: ${mode} -->`;
    let jobId: string | null = null;

    logger.info(`[SummarySkill] Starting. Document [${documentId}], Mode [${mode}], ForceRegen [${forceRegenerate}]`);

    try {
      // ── Step 0: Assess cache status ──
      const decision = await AssetGenerationManager.assess(supabase, userId, documentId, 'summary', mode);

      if (decision.action === 'return_cached' && !forceRegenerate) {
        logger.info(`[SummarySkill] Asset Generation Manager returned cached version.`);
        if (decision.existingAsset) {
          const content = decision.existingAsset.content as { summaryText?: string; keyPoints?: string[] } | null;
          return {
            success: true,
            summary: content?.summaryText,
            keyPoints: content?.keyPoints || [],
            createdAt: decision.existingAsset.generatedAt || decision.existingAsset.createdAt,
            cached: true,
            confidenceScore: decision.existingAsset.confidenceScore,
            confidenceLabel: decision.existingAsset.confidenceLabel ?? undefined,
            sourcesUsed: decision.existingAsset.sourcesUsed,
            assetId: decision.existingAsset.id,
            assetVersion: decision.existingAsset.version
          };
        }

        const legacyCached = await SummarySkillService.checkLegacyCache(supabase, documentId, modeTag);
        if (legacyCached) {
          return legacyCached;
        }
      }

      if (decision.action === 'wait_for_prerequisite' || decision.action === 'prerequisite_failed') {
        return {
          success: false,
          errorMessage: decision.reason
        };
      }

      // ── Step 1: Start job tracking & lock ──
      jobId = await AssetGenerationManager.recordGenerationStart(supabase, userId, documentId, 'summary', mode);
      if (!jobId) {
        throw new Error('Could not obtain generation job lock.');
      }

      // ── Step 2: Document Chunk Loading ──
      logger.info(`[SummarySkill] Cache miss / generation required. Loading document chunks...`);
      const rawChunks = await DocumentContextLoader.load({ documentId, userId, supabase });

      // Phase 8 validation: Check if chunks are valid
      PipelineValidator.validateChunking(rawChunks);

      logger.info(`[DEBUG][SummarySkill] Number of chunks loaded: ${rawChunks.length}`);

      // ── Step 3: Context Building using sliding window or hierarchical summarization ──
      const summaryQuery = `Summarize all key topics, concepts, definitions, and learning objectives in this document.`;
      let contextText = '';
      let isSummarizerStrategy = 'direct';

      if (rawChunks.length > 25) {
        // Hierarchical Summarization for massive documents
        isSummarizerStrategy = 'hierarchical';
        logger.info(`[SummarySkill] Large document (${rawChunks.length} chunks) detected. Activating Hierarchical Summarization.`);
        contextText = await SlidingWindowSummarizer.generateHierarchicalContext(userId, rawChunks, 6000, 8);
      } else if (rawChunks.length > 6) {
        // Sliding Window Summarization for medium documents
        isSummarizerStrategy = 'sliding-window';
        logger.info(`[SummarySkill] Medium document (${rawChunks.length} chunks) detected. Activating Sliding Window Summarization.`);
        contextText = await SlidingWindowSummarizer.generateSlidingWindowContext(userId, rawChunks, 4);
      } else {
        // Direct Context Building
        contextText = rawChunks.map(c => c.content).join('\n\n');
      }

      // Wrap consolidated context text as a simulated chunk for ContextBuilder pipeline compatibility
      const simulatedChunks: SearchResult[] = [{
        id: 'consolidated-pipeline-context',
        document_id: documentId,
        chunk_index: 0,
        content: contextText,
        similarity: 1.0,
        document_title: rawChunks[0]?.document_title || 'Document Content',
        confidence_score: 1.0,
        confidence_label: 'Excellent Match'
      }];

      // Build and validate context package
      const context = ContextBuilder.build(
        summaryQuery,
        simulatedChunks,
        8000
      );

      logger.info(`[SummarySkill] Context built via strategy: ${isSummarizerStrategy}. Chars: ${context.formattedContext.length}`);

      // ── Step 4: AI Response Engine ──
      const skillResult = await UniversalAIResponseEngine.executeSkill('SummarizeLecture', {
        query: summaryQuery,
        context,
        userId,
        variables: { mode: mode.toUpperCase() },
        skipCache: true
      });

      if (!skillResult.success) {
        throw new Error(`SummarizeLecture skill execution failed: ${skillResult.generatedContent}`);
      }

      // ── Step 5: Parse and Validate Output ──
      const parsed = SummarySkillService.parseMarkers(skillResult.generatedContent);

      if (!parsed.summaryText) {
        throw new Error('AI response did not contain valid ---SUM_START--- / ---SUM_END--- markers.');
      }

      // Phase 8 validation: Summary quality check
      PipelineValidator.validateSummary(parsed.summaryText);

      // ── Step 6: Register as a Knowledge Asset ──
      logger.info(`[SummarySkill] Registering Knowledge Asset...`);
      const assetContent = {
        summaryText: parsed.summaryText,
        keyPoints: parsed.keyPoints
      };

      const registeredAsset = await KnowledgeAssetRegistry.register(supabase, {
        userId,
        documentId,
        assetType: 'summary',
        mode,
        content: assetContent,
        aiSkill: 'SummarizeLecture',
        aiModel: skillResult.metadata.modelUsed,
        promptVersion: CURRENT_PROMPT_VERSION,
        retrievalChunks: rawChunks.length,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed: skillResult.sourcesUsed
      });

      if (!registeredAsset) {
        throw new Error('Knowledge Asset registry registration failed.');
      }

      // ── Step 7: Complete Job in Generation Manager ──
      await AssetGenerationManager.recordGenerationComplete(supabase, jobId, registeredAsset.id);

      // ── Step 8: Delete legacy ai_summaries row if force-regenerating ──
      if (forceRegenerate) {
        await SummarySkillService.deleteLegacyCacheRow(supabase, documentId, modeTag);
      }

      // ── Step 8: Generate embedding for summary ──
      let summaryEmbedding: number[] | null = null;
      try {
        summaryEmbedding = await getEmbedding(parsed.summaryText);
        logger.info(`[SummarySkill] Summary embedding generated.`);
      } catch (embErr: any) {
        logger.warn(`[SummarySkill] Embedding generation skipped: ${embErr?.message}`);
      }

      // ── Step 9: Persist to ai_summaries (backwards compatibility) ──
      const fullSummaryText = `${modeTag}\n\n${parsed.summaryText}`;
      const { data: newRow, error: insertError } = await supabase
        .from('ai_summaries')
        .insert({
          document_id: documentId,
          summary_text: fullSummaryText,
          key_points: parsed.keyPoints,
          embedding: summaryEmbedding
        })
        .select('created_at')
        .single();

      if (insertError) {
        logger.warn(`[SummarySkill] ai_summaries insert failed: ${insertError.message}`);
      }

      return {
        success: true,
        summary: parsed.summaryText,
        keyPoints: parsed.keyPoints,
        createdAt: registeredAsset?.generatedAt || newRow?.created_at || new Date().toISOString(),
        cached: false,
        retrievalChunks: rawChunks.length,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed: skillResult.sourcesUsed,
        assetId: registeredAsset?.id,
        assetVersion: registeredAsset?.version
      };

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[SummarySkill] Pipeline failed: ${msg}`);
      if (jobId) {
        await AssetGenerationManager.recordGenerationFailure(supabase, jobId, msg, 'generating');
      }
      return { success: false, errorMessage: msg };
    }
  }

  private static async checkLegacyCache(
    supabase: SupabaseClient,
    documentId: string,
    modeTag: string
  ): Promise<SummarySkillOutput | null> {
    const { data: rows } = await supabase
      .from('ai_summaries')
      .select('id, summary_text, key_points, created_at')
      .eq('document_id', documentId);

    if (!rows || rows.length === 0) return null;

    const cached = rows.find((r: any) => r.summary_text?.startsWith(modeTag));
    if (!cached) return null;

    const cleanText = (cached.summary_text as string).replace(modeTag, '').trim();
    return {
      success: true,
      summary: cleanText,
      keyPoints: cached.key_points || [],
      createdAt: cached.created_at,
      cached: true
    };
  }

  private static async deleteLegacyCacheRow(
    supabase: SupabaseClient,
    documentId: string,
    modeTag: string
  ): Promise<void> {
    const { data: rows } = await supabase
      .from('ai_summaries')
      .select('id, summary_text')
      .eq('document_id', documentId);

    if (!rows) return;

    const old = rows.find((r: any) => r.summary_text?.startsWith(modeTag));
    if (old) {
      logger.info(`[SummarySkill] Removing stale ai_summaries row [${old.id}].`);
      await supabase.from('ai_summaries').delete().eq('id', old.id);
    }
  }

  private static parseMarkers(text: string): { summaryText: string; keyPoints: string[] } {
    const sumMatch = text.match(/---SUM_START---([\s\S]*?)---SUM_END---/);
    const pointsMatch = text.match(/---POINTS_START---([\s\S]*?)---POINTS_END---/);

    const summaryText = sumMatch ? sumMatch[1].trim() : '';

    let keyPoints: string[] = [];
    if (pointsMatch) {
      try {
        keyPoints = JSON.parse(pointsMatch[1].trim());
      } catch {
        keyPoints = pointsMatch[1]
          .split('\n')
          .map((line: string) => line.replace(/^[-\s*"'\[\],]+|[\]"',]+$/g, '').trim())
          .filter(Boolean);
      }
    }

    return { summaryText, keyPoints };
  }
}
