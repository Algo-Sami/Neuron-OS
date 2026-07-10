/**
 * DefinitionsSkillService — Phase 11 Production AI Skill
 *
 * The Definitions Skill (Academic Glossary Engine).
 * Identifies important technical terms and creates glossary entries mapping
 * each to: definition, whyItMatters, realWorldExample, and examTip.
 *
 * Priorities:
 *   - Primary: Summary Asset AND Key Points Asset (combined)
 *   - Secondary fallback: Raw Cleaned Text from document_knowledge
 *   - Tertiary fallback: Consolidated document chunks
 *
 * Integrates directly with:
 *   - Phase 9: Asset Generation Manager (assessment, job lock, cancellations)
 *   - Phase 8: Knowledge Assets Layer (registration, validation, versions)
 *   - Phase 5: Universal AI Response Engine (GenerateDefinitions skill)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { AssetGenerationManager } from './asset-generation-manager';
import { KnowledgeAssetRegistry } from './knowledge-asset-registry';
import { UniversalAIResponseEngine } from './response-engine';
import { CURRENT_PROMPT_VERSION } from './ai-version-manifest';

export interface DefinitionsSkillInput {
  documentId: string;
  userId: string;
  forceRegenerate?: boolean;
  supabase: SupabaseClient;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  whyItMatters: string;
  realWorldExample: string;
  examTip: string;
}

export interface DefinitionsSkillOutput {
  success: boolean;
  glossary?: GlossaryEntry[];
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

export class DefinitionsSkillService {
  /**
   * Main entry point. Runs the glossary generation pipeline.
   */
  static async run(input: DefinitionsSkillInput): Promise<DefinitionsSkillOutput> {
    const { documentId, userId, forceRegenerate = false, supabase } = input;
    let jobId: string | null = null;

    logger.info(`[DefinitionsSkill] Starting. Document [${documentId}], ForceRegen [${forceRegenerate}]`);

    try {
      // ── Step 1: Assess status via Generation Manager (Phase 9) ─────────────
      const decision = await AssetGenerationManager.assess(supabase, userId, documentId, 'definitions');

      if (decision.action === 'return_cached' && !forceRegenerate) {
        logger.info(`[DefinitionsSkill] Cache hit. Serving stored glossary asset.`);
        if (decision.existingAsset) {
          const content = decision.existingAsset.content as GlossaryEntry[] | null;

          return {
            success: true,
            glossary: content || [],
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
      let combinedSourceText = '';
      const sourcesUsed: string[] = [];

      // 1. Primary: Load detailed Summary Asset
      const summaryAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'summary', 'detailed');
      if (summaryAsset && summaryAsset.status === 'ready') {
        const content = summaryAsset.content as { summaryText?: string } | null;
        if (content?.summaryText) {
          combinedSourceText += `LECTURE SUMMARY GUIDE:\n${content.summaryText}\n\n`;
          sourcesUsed.push(`summary:${summaryAsset.id}`);
        }
      }

      // 2. Primary: Load Key Points Asset
      const keyPointsAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'key_points');
      if (keyPointsAsset && keyPointsAsset.status === 'ready') {
        const content = keyPointsAsset.content as { keyPoints?: string[]; importantFacts?: string[] } | null;
        if (content) {
          const kpStr = content.keyPoints?.join('\n') || '';
          const factStr = content.importantFacts?.join('\n') || '';
          combinedSourceText += `LECTURE KEY REVISION POINTS:\n${kpStr}\n\nLECTURE KEY FACTS:\n${factStr}\n\n`;
          sourcesUsed.push(`key_points:${keyPointsAsset.id}`);
        }
      }

      // 3. Secondary Fallback: Load raw cleaned text
      if (!combinedSourceText.trim()) {
        logger.info(`[DefinitionsSkill] Summary & Key Points assets unavailable. Falling back to raw cleaned_text.`);
        const { data: dk } = await supabase
          .from('document_knowledge')
          .select('cleaned_text')
          .eq('document_id', documentId)
          .maybeSingle();

        if (dk?.cleaned_text) {
          combinedSourceText = dk.cleaned_text;
          sourcesUsed.push('document_knowledge:raw');
        }
      }

      // 4. Tertiary Fallback: Combine raw chunks
      if (!combinedSourceText.trim()) {
        logger.info(`[DefinitionsSkill] Cleaned text unavailable. Consolidating raw document_chunks.`);
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content')
          .eq('document_id', documentId)
          .order('chunk_index');

        if (chunks && chunks.length > 0) {
          combinedSourceText = chunks.map(c => c.content).join('\n\n');
          sourcesUsed.push('document_chunks:all');
        }
      }

      if (!combinedSourceText.trim()) {
        throw new Error('No source text, summaries, or key points found to generate definitions from.');
      }

      // ── Step 3: Concurrency Job Lock ──────────────────────────────────────
      jobId = await AssetGenerationManager.recordGenerationStart(supabase, userId, documentId, 'definitions');
      if (!jobId) {
        throw new Error('Failed to acquire generation lock from Asset Manager.');
      }

      // ── Step 4: Context Building & Token Budgeting ────────────────────────
      const optimizedText = combinedSourceText.length > 120000 
        ? combinedSourceText.slice(0, 120000) + "\n\n[Context truncated for size]" 
        : combinedSourceText;

      const contextPackage = {
        query: 'Extract definitions.',
        formattedContext: optimizedText,
        sources: [{ documentId, documentTitle: 'Glossary Context Sources', chunkIndices: [0], maxSimilarity: 1.0 }],
        overallConfidenceScore: 1.0,
        overallConfidenceLabel: 'Excellent Match' as const,
        estimatedTokens: Math.ceil(optimizedText.length / 4)
      };

      // ── Step 5: Execute Response Engine ───────────────────────────────────
      logger.info(`[DefinitionsSkill] Triggering AI glossary generation...`);
      const skillResult = await UniversalAIResponseEngine.executeSkill('GenerateDefinitions', {
        query: 'Build dictionary glossary entries.',
        context: contextPackage,
        userId,
        skipCache: true
      });

      if (!skillResult.success) {
        throw new Error(`AI generation failed: ${skillResult.generatedContent}`);
      }

      // ── Step 6: Parse & Register Knowledge Asset (Phase 8) ────────────────
      const cleanContent = skillResult.generatedContent.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanContent) as GlossaryEntry[];

      const registeredAsset = await KnowledgeAssetRegistry.register(supabase, {
        userId,
        documentId,
        assetType: 'definitions',
        mode: null,
        content: parsed,
        aiSkill: 'GenerateDefinitions',
        aiModel: skillResult.metadata.modelUsed,
        promptVersion: CURRENT_PROMPT_VERSION,
        retrievalChunks: 1,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed: sourcesUsed
      });

      if (!registeredAsset) {
        throw new Error('Failed to register definitions in the knowledge asset registry.');
      }

      // ── Step 7: Record Completion in Generation Manager (Phase 9) ─────────
      await AssetGenerationManager.recordGenerationComplete(supabase, jobId, registeredAsset.id);

      return {
        success: true,
        glossary: parsed,
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
      logger.error(`[DefinitionsSkill] Glossary pipeline failed: ${msg}`);

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
