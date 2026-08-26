/**
 * KnowledgeAssetRegistry — Phase 8: Knowledge Assets Layer
 *
 * The centralized control center for all AI-generated educational resources.
 *
 * Responsibilities:
 *   - Register new assets with full metadata
 *   - Transition asset lifecycle statuses
 *   - Enforce idempotency (no duplicate assets)
 *   - Archive previous versions before regeneration
 *   - Validate asset content per asset type
 *   - Query asset collections per lecture
 *
 * This service NEVER:
 *   - Calls any LLM
 *   - Retrieves vectors or chunks
 *   - Builds context
 *   - Executes prompts
 *
 * Those responsibilities belong to Phases 3, 4, and 5.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveVersion } from './ai-version-manifest';

// ── Asset Types ───────────────────────────────────────────────────────────────

export type AssetType =
  | 'summary'
  | 'key_points'
  | 'definitions'
  | 'examples'
  | 'flashcards'
  | 'quiz'
  | 'study_guide'
  | 'revision_notes'
  // Future types — pre-registered for zero schema changes:
  | 'mind_map'
  | 'cheat_sheet'
  | 'formula_sheet'
  | 'exam_pack'
  | 'concept_map';

export type AssetStatus =
  | 'requested'
  | 'generating'
  | 'validating'
  | 'stored'
  | 'ready'
  | 'failed'
  | 'archived'
  | 'outdated'
  | 'regenerating';

// ── Core Data Structures ──────────────────────────────────────────────────────

export interface KnowledgeAsset {
  id: string;
  userId: string;
  documentId: string;
  assetType: AssetType;
  mode: string | null;
  status: AssetStatus;
  content: Record<string, any> | any[] | null;
  aiSkill: string | null;
  aiModel: string | null;
  promptVersion: string;
  knowledgeVersion: number;
  /** The AI generation pipeline version at the time this asset was produced. */
  generationVersion: number;
  version: number;
  validationPassed: boolean | null;
  validationErrors: string[] | null;
  retrievalChunks: number;
  confidenceScore: number;
  confidenceLabel: string | null;
  sourcesUsed: string[];
  errorMessage: string | null;
  errorStage: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterAssetInput {
  userId: string;
  documentId: string;
  assetType: AssetType;
  mode?: string | null;
  content: Record<string, any> | any[];
  aiSkill: string;
  aiModel: string;
  promptVersion?: string;
  retrievalChunks?: number;
  confidenceScore?: number;
  confidenceLabel?: string;
  sourcesUsed?: string[];
}

export interface AssetStatusUpdate {
  status: AssetStatus;
  errorMessage?: string;
  errorStage?: string;
  aiModel?: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export interface AssetCollectionEntry {
  id: string;
  assetType: AssetType;
  mode: string | null;
  status: AssetStatus;
  version: number;
  confidenceScore: number;
  confidenceLabel: string | null;
  validationPassed: boolean | null;
  generatedAt: string | null;
  sourcesUsed: string[];
  updatedAt: string;
}

export interface AssetCollection {
  documentId: string;
  documentTitle: string;
  totalAssets: number;
  readyAssets: number;
  assets: AssetCollectionEntry[];
}

// ── Asset Validators ──────────────────────────────────────────────────────────

/**
 * Per-type validation rules.
 * Every new asset type should define its rules here.
 * No architectural changes needed — just add a new case.
 */
function validateAssetContent(assetType: AssetType, content: any): ValidationResult {
  const errors: string[] = [];

  try {
    switch (assetType) {
      case 'summary': {
        if (!content || typeof content !== 'object') {
          errors.push('content_must_be_object');
          break;
        }
        if (!content.summaryText || typeof content.summaryText !== 'string') {
          errors.push('summary_text_missing_or_invalid');
        } else if (content.summaryText.trim().length < 100) {
          errors.push('summary_text_too_short_min_100_chars');
        }
        if (!Array.isArray(content.keyPoints)) {
          errors.push('key_points_must_be_array');
        } else if (content.keyPoints.length === 0) {
          errors.push('key_points_must_have_at_least_one_item');
        }
        break;
      }

      case 'key_points': {
        if (!Array.isArray(content)) {
          errors.push('key_points_must_be_array');
        } else if (content.length === 0) {
          errors.push('key_points_array_is_empty');
        } else if (!content.every((p: any) => typeof p === 'string' && p.trim().length > 0)) {
          errors.push('all_key_points_must_be_non_empty_strings');
        }
        break;
      }

      case 'definitions': {
        if (!Array.isArray(content)) {
          errors.push('definitions_must_be_array');
        } else if (content.length === 0) {
          errors.push('definitions_array_is_empty');
        } else {
          for (let i = 0; i < content.length; i++) {
            const item = content[i];
            if (!item || typeof item !== 'object') { errors.push(`item_${i}_not_object`); continue; }
            if (!item.term || typeof item.term !== 'string') errors.push(`item_${i}_missing_term`);
            if (!item.definition || typeof item.definition !== 'string') errors.push(`item_${i}_missing_definition`);
          }
        }
        break;
      }

      case 'examples': {
        if (!Array.isArray(content)) {
          errors.push('examples_must_be_array');
        } else if (content.length === 0) {
          errors.push('examples_array_is_empty');
        }
        break;
      }

      case 'flashcards': {
        if (!Array.isArray(content)) {
          errors.push('flashcards_must_be_array');
        } else if (content.length === 0) {
          errors.push('flashcards_array_is_empty');
        } else {
          for (let i = 0; i < content.length; i++) {
            const card = content[i];
            if (!card || typeof card !== 'object') { errors.push(`card_${i}_not_object`); continue; }
            if (!card.front || typeof card.front !== 'string') errors.push(`card_${i}_missing_front`);
            if (!card.back  || typeof card.back  !== 'string') errors.push(`card_${i}_missing_back`);
          }
        }
        break;
      }

      case 'quiz': {
        if (!Array.isArray(content)) {
          errors.push('quiz_must_be_array');
        } else if (content.length === 0) {
          errors.push('quiz_array_is_empty');
        } else {
          for (let i = 0; i < content.length; i++) {
            const q = content[i];
            if (!q || typeof q !== 'object') { errors.push(`question_${i}_not_object`); continue; }
            if (!q.question || typeof q.question !== 'string') errors.push(`question_${i}_missing_question`);
            if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`question_${i}_options_invalid`);
            if (typeof q.correctAnswer !== 'number') errors.push(`question_${i}_missing_correct_answer`);
            if (!q.explanation || typeof q.explanation !== 'string') errors.push(`question_${i}_missing_explanation`);
          }
        }
        break;
      }

      case 'study_guide':
      case 'revision_notes':
      case 'cheat_sheet':
      case 'formula_sheet': {
        if (typeof content === 'string') {
          if (content.trim().length === 0) errors.push('content_is_empty_string');
        } else if (content && typeof content === 'object' && 'text' in content) {
          if (!content.text || typeof content.text !== 'string' || content.text.trim().length === 0) {
            errors.push('content_text_is_empty');
          }
        } else {
          errors.push('content_must_be_string_or_object_with_text');
        }
        break;
      }

      // Future types with no strict validation yet — accept anything non-null
      case 'mind_map':
      case 'exam_pack':
      case 'concept_map': {
        if (content === null || content === undefined) {
          errors.push('content_must_not_be_null');
        }
        break;
      }

      default: {
        // Unknown type — skip validation, log as warning
        logger.warn(`[AssetRegistry] No validator defined for asset type: ${assetType}`);
      }
    }
  } catch (err: any) {
    errors.push(`validator_exception: ${err?.message || String(err)}`);
  }

  return { passed: errors.length === 0, errors };
}

// ── KnowledgeAssetRegistry ────────────────────────────────────────────────────

export class KnowledgeAssetRegistry {

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Looks up an existing asset by (documentId, assetType, mode).
   * Returns null if no asset exists.
   * Use this for idempotency checks before running expensive AI work.
   */
  static async findExisting(
    supabase: SupabaseClient,
    documentId: string,
    assetType: AssetType,
    mode?: string | null
  ): Promise<KnowledgeAsset | null> {
    let query = supabase
      .from('knowledge_assets')
      .select('*')
      .eq('document_id', documentId)
      .eq('asset_type', assetType);

    if (mode !== undefined) {
      query = mode === null ? query.is('mode', null) : query.eq('mode', mode);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error(`[AssetRegistry] findExisting query failed: ${error.message}`);
      return null;
    }

    return data ? KnowledgeAssetRegistry.mapRow(data) : null;
  }

  /**
   * Returns the complete asset collection for a lecture (all asset types).
   * Only returns metadata — NOT full content (content fetched separately).
   */
  static async getAssetCollection(
    supabase: SupabaseClient,
    documentId: string,
    userId: string
  ): Promise<AssetCollection> {
    // Fetch document title
    const { data: doc } = await supabase
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    const docTitle = doc?.title || 'Untitled Document';

    // Fetch all assets for this document
    const { data: rows, error } = await supabase
      .from('knowledge_assets')
      .select('id, asset_type, mode, status, version, confidence_score, confidence_label, validation_passed, generated_at, sources_used, updated_at')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(`[AssetRegistry] getAssetCollection failed: ${error.message}`);
    }

    const assets: AssetCollectionEntry[] = (rows || []).map((r: any) => ({
      id: r.id,
      assetType: r.asset_type as AssetType,
      mode: r.mode,
      status: r.status as AssetStatus,
      version: r.version,
      confidenceScore: r.confidence_score ?? 0,
      confidenceLabel: r.confidence_label,
      validationPassed: r.validation_passed,
      generatedAt: r.generated_at,
      sourcesUsed: r.sources_used || [],
      updatedAt: r.updated_at
    }));

    const readyAssets = assets.filter(a => a.status === 'ready').length;

    return {
      documentId,
      documentTitle: docTitle,
      totalAssets: assets.length,
      readyAssets,
      assets
    };
  }

  /**
   * Creates or updates a knowledge asset after AI generation completes.
   *
   * If an asset already exists for (documentId, assetType, mode):
   *   - Archives the current version in knowledge_asset_versions
   *   - Increments the version counter
   *   - Updates the asset row with the new content
   *
   * If no asset exists:
   *   - Creates a new row at version 1
   *
   * Always validates content before marking status = 'ready'.
   * Sets status = 'failed' if validation fails.
   */
  static async register(
    supabase: SupabaseClient,
    input: RegisterAssetInput
  ): Promise<KnowledgeAsset | null> {
    const {
      userId,
      documentId,
      assetType,
      mode = null,
      content,
      aiSkill,
      aiModel,
      promptVersion = '1.0',
      retrievalChunks = 0,
      confidenceScore = 0,
      confidenceLabel,
      sourcesUsed = []
    } = input;

    KnowledgeAssetRegistry.logToDisk(`[Register] Start — Doc: ${documentId}, Type: ${assetType}, Mode: ${mode || 'none'}`);

    try {
      // 1. Validate content
      KnowledgeAssetRegistry.logToDisk(`[Register] Validating content for type: ${assetType}`);
      const validation = validateAssetContent(assetType, content);

      const finalStatus: AssetStatus = validation.passed ? 'ready' : 'failed';
      const now = new Date().toISOString();

      if (!validation.passed) {
        KnowledgeAssetRegistry.logToDisk(`[Register] Validation FAILED: ${validation.errors.join(', ')}`, 'WARN');
      } else {
        KnowledgeAssetRegistry.logToDisk(`[Register] Validation PASSED`);
      }

      // 2. Check if an existing asset needs to be versioned
      const existing = await KnowledgeAssetRegistry.findExisting(supabase, documentId, assetType, mode);

      if (existing) {
        // Archive the old version
        await KnowledgeAssetRegistry.archiveVersion(supabase, existing);

        // Update the existing row
        const newVersion = existing.version + 1;
        const { data: updated, error: updateErr } = await supabase
          .from('knowledge_assets')
          .update({
            status: finalStatus,
            content,
            ai_skill: aiSkill,
            ai_model: aiModel,
            prompt_version: promptVersion,
            generation_version: getEffectiveVersion(assetType),
            version: newVersion,
            validation_passed: validation.passed,
            validation_errors: validation.errors.length > 0 ? validation.errors : null,
            retrieval_chunks: retrievalChunks,
            confidence_score: confidenceScore,
            confidence_label: confidenceLabel,
            sources_used: sourcesUsed,
            error_message: validation.passed ? null : `Validation failed: ${validation.errors.join(', ')}`,
            error_stage: validation.passed ? null : 'validating',
            generated_at: now,
            updated_at: now
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (updateErr) {
          logger.error(`[AssetRegistry] Update failed: ${updateErr.message}`);
          return null;
        }

        KnowledgeAssetRegistry.logToDisk(`[Register] Updated existing asset [${existing.id}] to v${newVersion}, status: ${finalStatus}`);
        return KnowledgeAssetRegistry.mapRow(updated);
      }

      // 3. Create new asset at version 1
      const { data: created, error: insertErr } = await supabase
        .from('knowledge_assets')
        .insert({
          user_id: userId,
          document_id: documentId,
          asset_type: assetType,
          mode,
          status: finalStatus,
          content,
          ai_skill: aiSkill,
          ai_model: aiModel,
          prompt_version: promptVersion,
          knowledge_version: 1,
          generation_version: getEffectiveVersion(assetType),
          version: 1,
          validation_passed: validation.passed,
          validation_errors: validation.errors.length > 0 ? validation.errors : null,
          retrieval_chunks: retrievalChunks,
          confidence_score: confidenceScore,
          confidence_label: confidenceLabel,
          sources_used: sourcesUsed,
          error_message: validation.passed ? null : `Validation failed: ${validation.errors.join(', ')}`,
          error_stage: validation.passed ? null : 'validating',
          generated_at: now
        })
        .select('*')
        .single();

      if (insertErr) {
        logger.error(`[AssetRegistry] Insert failed: ${insertErr.message}`);
        return null;
      }

      KnowledgeAssetRegistry.logToDisk(`[Register] Created new asset [${created.id}], status: ${finalStatus}`);
      return KnowledgeAssetRegistry.mapRow(created);

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[AssetRegistry] register() threw: ${msg}`);
      KnowledgeAssetRegistry.logToDisk(`[Register] EXCEPTION: ${msg}`, 'ERROR');
      return null;
    }
  }

  /**
   * Transitions an asset to a new lifecycle status.
   * Used by AI skills to report generating → validating → ready / failed.
   */
  static async updateStatus(
    supabase: SupabaseClient,
    assetId: string,
    update: AssetStatusUpdate
  ): Promise<void> {
    const patch: Record<string, any> = {
      status: update.status,
      updated_at: new Date().toISOString()
    };

    if (update.errorMessage !== undefined) patch.error_message = update.errorMessage;
    if (update.errorStage   !== undefined) patch.error_stage   = update.errorStage;
    if (update.aiModel      !== undefined) patch.ai_model      = update.aiModel;
    if (update.status === 'ready')         patch.generated_at  = new Date().toISOString();

    const { error } = await supabase
      .from('knowledge_assets')
      .update(patch)
      .eq('id', assetId);

    if (error) {
      logger.error(`[AssetRegistry] updateStatus failed for [${assetId}]: ${error.message}`);
    } else {
      KnowledgeAssetRegistry.logToDisk(`[Status] Asset [${assetId}] → ${update.status}`);
    }
  }

  /**
   * Marks an asset as 'failed' with a detailed error message and stage.
   */
  static async markFailed(
    supabase: SupabaseClient,
    assetId: string,
    errorMessage: string,
    errorStage: string
  ): Promise<void> {
    await KnowledgeAssetRegistry.updateStatus(supabase, assetId, {
      status: 'failed',
      errorMessage,
      errorStage
    });
  }

  /**
   * Validates asset content without persisting anything.
   * Used by AI skills for pre-storage checks.
   */
  static validate(assetType: AssetType, content: any): ValidationResult {
    return validateAssetContent(assetType, content);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Archives the current content of an asset to knowledge_asset_versions
   * before it is overwritten by regeneration.
   */
  private static async archiveVersion(
    supabase: SupabaseClient,
    asset: KnowledgeAsset
  ): Promise<void> {
    const { error } = await supabase
      .from('knowledge_asset_versions')
      .insert({
        asset_id: asset.id,
        user_id: asset.userId,
        document_id: asset.documentId,
        version: asset.version,
        asset_type: asset.assetType,
        mode: asset.mode,
        content: asset.content,
        ai_skill: asset.aiSkill,
        ai_model: asset.aiModel,
        prompt_version: asset.promptVersion,
        confidence_score: asset.confidenceScore
      });

    if (error) {
      // Non-fatal: log but don't block the regeneration
      logger.warn(`[AssetRegistry] archiveVersion failed for asset [${asset.id}]: ${error.message}`);
    } else {
      KnowledgeAssetRegistry.logToDisk(`[Archive] Asset [${asset.id}] v${asset.version} archived.`);
    }
  }

  /**
   * Maps a raw Supabase row to a typed KnowledgeAsset object.
   */
  private static mapRow(row: any): KnowledgeAsset {
    return {
      id: row.id,
      userId: row.user_id,
      documentId: row.document_id,
      assetType: row.asset_type,
      mode: row.mode,
      status: row.status,
      content: row.content,
      aiSkill: row.ai_skill,
      aiModel: row.ai_model,
      promptVersion: row.prompt_version,
      knowledgeVersion: row.knowledge_version,
      generationVersion: row.generation_version ?? 1,
      version: row.version,
      validationPassed: row.validation_passed,
      validationErrors: row.validation_errors,
      retrievalChunks: row.retrieval_chunks ?? 0,
      confidenceScore: row.confidence_score ?? 0,
      confidenceLabel: row.confidence_label,
      sourcesUsed: row.sources_used || [],
      errorMessage: row.error_message,
      errorStage: row.error_stage,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Disk logger for observability without cluttering the main log stream.
   */
  private static logToDisk(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    try {
      const ts = new Date().toISOString();
      const line = `[${ts}] [KnowledgeAssetRegistry] (${level}) ${message}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'background_logs.txt'), line);
    } catch { /* ignore */ }
  }
}
