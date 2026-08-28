/**
 * KeyPointsSkillService — Phase 10 Production AI Skill
 *
 * The first knowledge-derived AI skill in Neuron OS.
 * Consumes the validated Summary Asset as its primary source of truth,
 * with progressive fallbacks to raw document knowledge and chunks.
 *
 * Integrates directly with:
 *   - Phase 9: Asset Generation Manager (assessments, locks, failure cascades)
 *   - Phase 8: Knowledge Assets Layer (registration, metadata, version history)
 *   - Phase 5: Universal AI Response Engine (GenerateKeyPoints skill)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { AssetGenerationManager } from './asset-generation-manager';
import { KnowledgeAssetRegistry } from './knowledge-asset-registry';
import { UniversalAIResponseEngine } from './response-engine';
import { CURRENT_PROMPT_VERSION } from './ai-version-manifest';

export interface KeyPointsSkillInput {
  documentId: string;
  userId: string;
  forceRegenerate?: boolean;
  supabase: SupabaseClient;
}

export interface KeyPointsSkillOutput {
  success: boolean;
  lectureTitle?: string;
  keyPoints?: string[];
  importantFacts?: string[];
  quickRevisionTips?: string[];
  createdAt?: string;
  cached?: boolean;
  errorMessage?: string;
  // Observability metadata
  retrievalChunks?: number;
  confidenceScore?: number;
  confidenceLabel?: string;
  sourcesUsed?: string[];
  assetId?: string;
  assetVersion?: number;
}

export class KeyPointsSkillService {
  /**
   * Main entry point. Orchestrates the Key Points generation pipeline.
   */
  static async run(input: KeyPointsSkillInput): Promise<KeyPointsSkillOutput> {
    const { documentId, userId, forceRegenerate = false, supabase } = input;
    let jobId: string | null = null;

    logger.info(`[KeyPointsSkill] Starting. Document [${documentId}], ForceRegen [${forceRegenerate}]`);

    try {
      // ── Step 1: Assess status via Generation Manager (Phase 9) ─────────────
      const decision = await AssetGenerationManager.assess(supabase, userId, documentId, 'key_points');

      if (decision.action === 'return_cached' && !forceRegenerate) {
        logger.info(`[KeyPointsSkill] Cache hit. Serving stored asset.`);
        if (decision.existingAsset) {
          const content = decision.existingAsset.content as {
            lectureTitle?: string;
            keyPoints?: string[];
            importantFacts?: string[];
            quickRevisionTips?: string[];
          } | null;

          return {
            success: true,
            lectureTitle: content?.lectureTitle || 'Key Takeaways',
            keyPoints: content?.keyPoints || [],
            importantFacts: content?.importantFacts || [],
            quickRevisionTips: content?.quickRevisionTips || [],
            createdAt: decision.existingAsset.generatedAt || decision.existingAsset.createdAt,
            cached: true,
            confidenceScore: decision.existingAsset.confidenceScore,
            confidenceLabel: decision.existingAsset.confidenceLabel ?? undefined,
            sourcesUsed: decision.existingAsset.sourcesUsed,
            assetId: decision.existingAsset.id,
            assetVersion: decision.existingAsset.version
          };
        }
      }

      if (decision.action === 'wait_for_prerequisite') {
        return { success: false, errorMessage: decision.reason };
      }

      if (decision.action === 'prerequisite_failed') {
        return { success: false, errorMessage: decision.reason };
      }

      // ── Step 2: Establish Source Knowledge Input Priority Chain ────────────
      let sourceText = '';

      // Priority 1: Ready detailed summary asset
      const summaryAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'summary', 'detailed');
      if (summaryAsset && summaryAsset.status === 'ready') {
        const content = summaryAsset.content as { summaryText?: string } | null;
        if (content?.summaryText) {
          sourceText = content.summaryText;
          logger.info(`[KeyPointsSkill] Loaded summary asset [${summaryAsset.id}] as primary source.`);
        }
      }

      // Priority 2: Fallback to raw extracted cleaned text
      if (!sourceText) {
        logger.info(`[KeyPointsSkill] Summary asset missing/invalid. Checking document_knowledge table.`);
        const { data: dk } = await supabase
          .from('document_knowledge')
          .select('cleaned_text')
          .eq('document_id', documentId)
          .maybeSingle();

        if (dk?.cleaned_text) {
          sourceText = dk.cleaned_text;
        }
      }

      // Priority 3: Fallback to raw chunks combination
      if (!sourceText) {
        logger.info(`[KeyPointsSkill] Raw cleaned text missing. Loading document_chunks.`);
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content')
          .eq('document_id', documentId)
          .order('chunk_index');

        if (chunks && chunks.length > 0) {
          sourceText = chunks.map(c => c.content).join('\n\n');
        }
      }

      if (!sourceText || sourceText.trim().length === 0) {
        throw new Error('No source document text or summary found to generate key points from.');
      }

      // ── Step 3: Concurrency Job Lock ──────────────────────────────────────
      jobId = await AssetGenerationManager.recordGenerationStart(supabase, userId, documentId, 'key_points');
      if (!jobId) {
        throw new Error('Failed to acquire generation lock from Asset Manager.');
      }

      // ── Step 4: Context Building & Prompts ────────────────────────────────
      // We package the sourceText as context for the response engine.
      // Limit context block size to prevent model overflow.
      const optimizedText = sourceText.length > 120000 ? sourceText.slice(0, 120000) + "\n\n[Summary context truncated]" : sourceText;

      const contextPackage = {
        query: 'Generate structured academic key points.',
        formattedContext: optimizedText,
        sources: [{ documentId, documentTitle: 'Source Summary Guide', chunkIndices: [0], maxSimilarity: 1.0 }],
        overallConfidenceScore: 1.0,
        overallConfidenceLabel: 'Excellent Match' as const,
        estimatedTokens: Math.ceil(optimizedText.length / 4)
      };

      // ── Step 5: Execute AI response engine ────────────────────────────────
      logger.info(`[KeyPointsSkill] Triggering AI generation...`);
      const skillResult = await UniversalAIResponseEngine.executeSkill('GenerateKeyPoints', {
        query: 'Extract revision points.',
        context: contextPackage,
        userId,
        skipCache: true
      });

      if (!skillResult.success) {
        throw new Error(`AI generation failed: ${skillResult.generatedContent}`);
      }

      // ── Step 6: Parse and validate JSON structure ────────────────────────
      const cleanContent = skillResult.generatedContent.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanContent) as {
        lectureTitle: string;
        keyPoints: string[];
        importantFacts: string[];
        quickRevisionTips: string[];
      };

      // ── Step 7: Register permanent Knowledge Asset (Phase 8) ──────────────
      const registeredAsset = await KnowledgeAssetRegistry.register(supabase, {
        userId,
        documentId,
        assetType: 'key_points',
        mode: null, // key points doesn't have mode variants
        content: parsed,
        aiSkill: 'GenerateKeyPoints',
        aiModel: skillResult.metadata.modelUsed,
        promptVersion: CURRENT_PROMPT_VERSION,
        retrievalChunks: 1, // generated from single unified context package
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed: skillResult.sourcesUsed
      });

      if (!registeredAsset) {
        throw new Error('Failed to register key points in the knowledge registry.');
      }

      // ── Step 8: Mark Generation Complete in Manager ───────────────────────
      await AssetGenerationManager.recordGenerationComplete(supabase, jobId, registeredAsset.id);

      return {
        success: true,
        lectureTitle: parsed.lectureTitle,
        keyPoints: parsed.keyPoints,
        importantFacts: parsed.importantFacts,
        quickRevisionTips: parsed.quickRevisionTips,
        createdAt: registeredAsset.generatedAt || new Date().toISOString(),
        cached: false,
        retrievalChunks: contextPackage.sources.length,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed: skillResult.sourcesUsed,
        assetId: registeredAsset.id,
        assetVersion: registeredAsset.version
      };

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[KeyPointsSkill] Generation failed: ${msg}`);

      if (jobId) {
        await AssetGenerationManager.recordGenerationFailure(supabase, jobId, msg, 'generating');
      }

      return {
        success: false,
        errorMessage: msg
      };
    }
  }
}
