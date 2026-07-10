/**
 * ExamplesSkillService — Phase 12: Concept Understanding Engine
 *
 * Generates categorized educational examples for the key academic concepts
 * in a lecture: real-world, technical, analogy, and exam-oriented examples.
 *
 * Input Priority Chain:
 *   1. Summary Asset + Key Points Asset + Definitions Asset (combined context)
 *   2. Raw cleaned text from document_knowledge
 *   3. Consolidated document_chunks
 *
 * Integrates with:
 *   - Phase 9: Asset Generation Manager
 *   - Phase 8: Knowledge Assets Layer
 *   - Phase 5: Universal AI Response Engine (GenerateExamples skill)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { AssetGenerationManager } from './asset-generation-manager';
import { KnowledgeAssetRegistry } from './knowledge-asset-registry';
import { UniversalAIResponseEngine } from './response-engine';
import { CURRENT_PROMPT_VERSION } from './ai-version-manifest';

export interface ConceptExample {
  concept: string;
  realWorldExample?: string | null;
  technicalExample?: string | null;
  analogy?: string | null;
  examExample?: string | null;
}

export interface ExamplesSkillInput {
  documentId: string;
  userId: string;
  forceRegenerate?: boolean;
  supabase: SupabaseClient;
}

export interface ExamplesSkillOutput {
  success: boolean;
  examples?: ConceptExample[];
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

export class ExamplesSkillService {
  static async run(input: ExamplesSkillInput): Promise<ExamplesSkillOutput> {
    const { documentId, userId, forceRegenerate = false, supabase } = input;
    let jobId: string | null = null;

    logger.info(`[ExamplesSkill] Starting. Document [${documentId}], ForceRegen [${forceRegenerate}]`);

    try {
      // ── Step 1: Assess via Generation Manager (Phase 9) ───────────────────
      const decision = await AssetGenerationManager.assess(supabase, userId, documentId, 'examples');

      if (decision.action === 'return_cached' && !forceRegenerate) {
        logger.info(`[ExamplesSkill] Cache hit. Serving stored examples asset.`);
        if (decision.existingAsset) {
          const content = decision.existingAsset.content as ConceptExample[] | null;
          return {
            success: true,
            examples: content || [],
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

      // ── Step 2: Build combined context from all available assets ──────────
      let combinedContext = '';
      const sourcesUsed: string[] = [];

      // Priority 1a: Summary Asset
      const summaryAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'summary', 'detailed');
      if (summaryAsset?.status === 'ready') {
        const c = summaryAsset.content as { summaryText?: string } | null;
        if (c?.summaryText) {
          combinedContext += `LECTURE SUMMARY:\n${c.summaryText}\n\n`;
          sourcesUsed.push(`summary:${summaryAsset.id}`);
        }
      }

      // Priority 1b: Key Points Asset
      const keyPointsAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'key_points');
      if (keyPointsAsset?.status === 'ready') {
        const c = keyPointsAsset.content as { keyPoints?: string[]; importantFacts?: string[] } | null;
        if (c) {
          const kp = (c.keyPoints || []).join('\n');
          const facts = (c.importantFacts || []).join('\n');
          combinedContext += `KEY REVISION POINTS:\n${kp}\n\nIMPORTANT FACTS:\n${facts}\n\n`;
          sourcesUsed.push(`key_points:${keyPointsAsset.id}`);
        }
      }

      // Priority 1c: Definitions Asset
      const definitionsAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, 'definitions');
      if (definitionsAsset?.status === 'ready') {
        const defs = definitionsAsset.content as Array<{ term: string; definition: string }> | null;
        if (defs && defs.length > 0) {
          const defStr = defs.map(d => `${d.term}: ${d.definition}`).join('\n');
          combinedContext += `ACADEMIC GLOSSARY:\n${defStr}\n\n`;
          sourcesUsed.push(`definitions:${definitionsAsset.id}`);
        }
      }

      // Priority 2: Fallback to raw cleaned text
      if (!combinedContext.trim()) {
        logger.info(`[ExamplesSkill] Primary assets unavailable. Falling back to document_knowledge.`);
        const { data: dk } = await supabase
          .from('document_knowledge')
          .select('cleaned_text')
          .eq('document_id', documentId)
          .maybeSingle();
        if (dk?.cleaned_text) {
          combinedContext = dk.cleaned_text;
          sourcesUsed.push('document_knowledge:raw');
        }
      }

      // Priority 3: Fallback to raw chunks
      if (!combinedContext.trim()) {
        logger.info(`[ExamplesSkill] Falling back to raw document_chunks.`);
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content')
          .eq('document_id', documentId)
          .order('chunk_index');
        if (chunks && chunks.length > 0) {
          combinedContext = chunks.map(c => c.content).join('\n\n');
          sourcesUsed.push('document_chunks:all');
        }
      }

      if (!combinedContext.trim()) {
        throw new Error('No source content (summary, key points, definitions, or raw text) available to generate examples from.');
      }

      // ── Step 3: Concurrency Job Lock ──────────────────────────────────────
      jobId = await AssetGenerationManager.recordGenerationStart(supabase, userId, documentId, 'examples');
      if (!jobId) {
        throw new Error('Failed to acquire generation lock from Asset Manager.');
      }

      // ── Step 4: Build context package & call Response Engine ──────────────
      const optimizedText = combinedContext.length > 120000
        ? combinedContext.slice(0, 120000) + '\n\n[Context truncated for size]'
        : combinedContext;

      const contextPackage = {
        query: 'Generate educational concept examples.',
        formattedContext: optimizedText,
        sources: [{ documentId, documentTitle: 'Examples Context', chunkIndices: [0], maxSimilarity: 1.0 }],
        overallConfidenceScore: 1.0,
        overallConfidenceLabel: 'Excellent Match' as const,
        estimatedTokens: Math.ceil(optimizedText.length / 4)
      };

      logger.info(`[ExamplesSkill] Triggering AI examples generation...`);
      const skillResult = await UniversalAIResponseEngine.executeSkill('GenerateExamples', {
        query: 'Generate categorized concept examples.',
        context: contextPackage,
        userId,
        skipCache: true
      });

      if (!skillResult.success) {
        throw new Error(`AI generation failed: ${skillResult.generatedContent}`);
      }

      // ── Step 5: Parse, register, complete ────────────────────────────────
      const cleanContent = skillResult.generatedContent.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanContent) as ConceptExample[];

      const registeredAsset = await KnowledgeAssetRegistry.register(supabase, {
        userId,
        documentId,
        assetType: 'examples',
        mode: null,
        content: parsed,
        aiSkill: 'GenerateExamples',
        aiModel: skillResult.metadata.modelUsed,
        promptVersion: CURRENT_PROMPT_VERSION,
        retrievalChunks: 1,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed
      });

      if (!registeredAsset) {
        throw new Error('Failed to register examples in the knowledge asset registry.');
      }

      await AssetGenerationManager.recordGenerationComplete(supabase, jobId, registeredAsset.id);

      return {
        success: true,
        examples: parsed,
        createdAt: registeredAsset.generatedAt || new Date().toISOString(),
        cached: false,
        retrievalChunks: 1,
        confidenceScore: skillResult.confidenceScore,
        confidenceLabel: skillResult.confidenceLabel,
        sourcesUsed,
        assetId: registeredAsset.id,
        assetVersion: registeredAsset.version
      };

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[ExamplesSkill] Pipeline failed: ${msg}`);
      if (jobId) {
        await AssetGenerationManager.recordGenerationFailure(supabase, jobId, msg, 'generating');
      }
      return { success: false, errorMessage: msg };
    }
  }
}
