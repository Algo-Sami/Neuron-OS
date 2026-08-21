/**
 * AssetGenerationManager — Phase 9
 *
 * The operating system scheduler and lifecycle controller for all AI-generated
 * knowledge assets in Neuron OS.
 *
 * Responsibilities:
 *   - Main dependency graph mapping for all asset types.
 *   - Deciding if an asset should be generated, reused, or if it must wait for prerequisites.
 *   - Preventing duplicate concurrent generation runs via the asset_generation_jobs table.
 *   - Propagating outdating when document embeddings / source knowledge changes.
 *   - Tracking active / queued background tasks.
 *
 * This manager NEVER:
 *   - Calls any LLM or Gemini.
 *   - Performs vector / chunk searches.
 *   - Parses prompts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { AssetType, AssetStatus, KnowledgeAsset, KnowledgeAssetRegistry } from './knowledge-asset-registry';
import { isVersionOutdated, getEffectiveVersion, formatVersionLog } from './ai-version-manifest';
import { JobRecoveryService } from './job-recovery-service';
import * as fs from 'fs';

// ── Dependency Graph Definition ────────────────────────────────────────────────

export const ASSET_DEPENDENCY_GRAPH: Record<AssetType, AssetType[]> = {
  summary: [],
  key_points: ['summary'],
  definitions: ['key_points'],
  examples: ['definitions'],
  flashcards: ['summary'],
  quiz: ['summary'],
  study_guide: ['summary'],
  revision_notes: ['summary'],
  
  // Future asset types
  mind_map: ['summary', 'key_points'],
  cheat_sheet: ['summary', 'key_points'],
  formula_sheet: ['summary'],
  exam_pack: ['summary', 'quiz', 'flashcards'],
  concept_map: ['summary', 'definitions']
};

export type GenerationAction =
  | 'return_cached'
  | 'generate'
  | 'wait_for_prerequisite'
  | 'prerequisite_failed';

export interface GenerationDecision {
  action: GenerationAction;
  reason: string;
  existingAsset?: KnowledgeAsset | null;
  missingPrerequisites?: AssetType[];
  failedPrerequisites?: AssetType[];
}

export interface GenerationPlanStep {
  order: number;
  assetType: AssetType;
  mode?: string | null;
  dependsOn: AssetType[];
  status: 'already_ready' | 'needs_generation' | 'in_progress' | 'failed_dependency';
}

export interface GenerationPlan {
  requestId: string;
  steps: GenerationPlanStep[];
  alreadyReady: AssetType[];
  toGenerate: AssetType[];
  totalSteps: number;
}

export class AssetGenerationManager {

  // ── 1. Assessment & Dependency Resolution ─────────────────────────────────────

  /**
   * Assesses whether a target asset is ready, can be generated, or is blocked by dependencies.
   * Guarantees idempotency and checks the active generation jobs pool.
   */
  static async assess(
    supabase: SupabaseClient,
    userId: string,
    documentId: string,
    assetType: AssetType,
    mode: string | null = null
  ): Promise<GenerationDecision> {
    const logPrefix = `[AssetManager][Assess] Doc: ${documentId}, Type: ${assetType}, Mode: ${mode || 'none'}`;
    AssetGenerationManager.logToDisk(`${logPrefix} assessing...`);

    try {
      // Auto-recover any stale asset generation jobs for this document before assessing
      await JobRecoveryService.recoverStaleAssetJobs(supabase, documentId);

      // 1. Get dependencies
      const dependencies = ASSET_DEPENDENCY_GRAPH[assetType] || [];
      const missingPrerequisites: AssetType[] = [];
      const failedPrerequisites: AssetType[] = [];

      // 2. Evaluate all prerequisites
      for (const depType of dependencies) {
        // For simplicity, prerequisites like 'summary' are checked with mode 'detailed' or default/null.
        // If a dependency has mode variants, we check if ANY variant is ready.
        const { data: depAssets, error: depErr } = await supabase
          .from('knowledge_assets')
          .select('*')
          .eq('document_id', documentId)
          .eq('asset_type', depType);

        if (depErr) {
          logger.error(`[AssetManager] Error fetching dependency ${depType}: ${depErr.message}`);
          missingPrerequisites.push(depType);
          continue;
        }

        const readyDep = depAssets?.find((a: any) => a.status === 'ready');
        const failedDep = depAssets?.find((a: any) => a.status === 'failed');

        if (!readyDep) {
          if (failedDep) {
            failedPrerequisites.push(depType);
          } else {
            missingPrerequisites.push(depType);
          }
        }
      }

      if (failedPrerequisites.length > 0) {
        AssetGenerationManager.logToDisk(`${logPrefix} Blocked: Prerequisite failed: ${failedPrerequisites.join(', ')}`, 'WARN');
        return {
          action: 'prerequisite_failed',
          reason: `Cannot generate because prerequisite assets failed: ${failedPrerequisites.join(', ')}`,
          failedPrerequisites
        };
      }

      if (missingPrerequisites.length > 0) {
        AssetGenerationManager.logToDisk(`${logPrefix} Blocked: Missing prerequisites: ${missingPrerequisites.join(', ')}`);
        return {
          action: 'wait_for_prerequisite',
          reason: `Waiting for prerequisites: ${missingPrerequisites.join(', ')}`,
          missingPrerequisites
        };
      }

      // 3. Evaluate target asset
      const targetAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, assetType, mode);

      if (targetAsset) {
        // ── Generation Version Check ─────────────────────────────────────────
        // Before returning a cached asset, compare its generation_version against
        // the current AI_GENERATION_VERSION. This is a pure integer comparison —
        // no AI, no DB reads beyond the asset row already fetched above.
        if (targetAsset.status === 'ready') {
          const storedVersion = targetAsset.generationVersion;
          const currentVersion = getEffectiveVersion(assetType);

          if (isVersionOutdated(storedVersion, assetType)) {
            AssetGenerationManager.logToDisk(
              formatVersionLog(assetType, storedVersion, 'OUTDATED') +
              ' — Triggering automatic regeneration.',
              'WARN'
            );

            // Mark the asset outdated in the DB so the generation path picks it up
            await AssetGenerationManager.markAssetOutdated(supabase, targetAsset.id, currentVersion);

            return {
              action: 'generate',
              reason: `Asset generation_version (v${storedVersion ?? 0}) is outdated. Current: v${currentVersion}. Automatic regeneration triggered.`,
              existingAsset: targetAsset
            };
          }

          // Version matches — return cached instantly
          AssetGenerationManager.logToDisk(
            formatVersionLog(assetType, storedVersion, 'CACHED') + ' — Returning instantly.'
          );
          return {
            action: 'return_cached',
            reason: 'Asset is ready and generation version matches.',
            existingAsset: targetAsset
          };
        }

        // If it's already generating/validating, check active jobs
        if (['requested', 'generating', 'validating', 'stored', 'regenerating'].includes(targetAsset.status)) {
          // Check if there is an active job matching it
          const { data: activeJob } = await supabase
            .from('asset_generation_jobs')
            .select('status')
            .eq('document_id', documentId)
            .eq('asset_type', assetType)
            .eq('mode', mode || '')
            .in('status', ['queued', 'running'])
            .maybeSingle();

          if (activeJob) {
            AssetGenerationManager.logToDisk(`${logPrefix} Generation already in progress. Action: wait.`);
            return {
              action: 'wait_for_prerequisite',
              reason: `Generation job is currently in status: ${activeJob.status}`,
              existingAsset: targetAsset
            };
          }
        }

        // If outdated or failed, it is eligible for regeneration/generation
        if (targetAsset.status === 'outdated' || targetAsset.status === 'failed') {
          AssetGenerationManager.logToDisk(`${logPrefix} Asset exists but is ${targetAsset.status}. Re-generation allowed.`);
          return {
            action: 'generate',
            reason: `Asset is ${targetAsset.status}. Proceeding to generate.`,
            existingAsset: targetAsset
          };
        }
      }

      // Target asset is completely missing
      AssetGenerationManager.logToDisk(`${logPrefix} Asset is missing. Proceeding to generate.`);
      return {
        action: 'generate',
        reason: 'Asset is missing.'
      };

    } catch (err: any) {
      const msg = err?.message || String(err);
      logger.error(`[AssetManager] assess() exception: ${msg}`);
      AssetGenerationManager.logToDisk(`${logPrefix} Exception: ${msg}`, 'ERROR');
      return {
        action: 'generate',
        reason: `Manager assessment exception: ${msg}`
      };
    }
  }

  // ── 2. Generation Queue & Active Jobs Lifecycle ───────────────────────────────

  /**
   * Records that generation has started for an asset.
   * Inserts an active lock record in asset_generation_jobs.
   */
  static async recordGenerationStart(
    supabase: SupabaseClient,
    userId: string,
    documentId: string,
    assetType: AssetType,
    mode: string | null = null,
    requestId: string = 'req-' + Math.random().toString(36).substr(2, 9)
  ): Promise<string | null> {
    const modeStr = mode || '';
    AssetGenerationManager.logToDisk(`[JobStart] Recording start for Doc: ${documentId}, Type: ${assetType}, Mode: ${modeStr}`);

    try {
      // Auto-recover any stale asset generation jobs for this document before starting
      await JobRecoveryService.recoverStaleAssetJobs(supabase, documentId);

      // 1. Check if a job is already running to guarantee concurrency locks
      const { data: existingJob } = await supabase
        .from('asset_generation_jobs')
        .select('id')
        .eq('document_id', documentId)
        .eq('asset_type', assetType)
        .eq('mode', modeStr)
        .in('status', ['queued', 'running'])
        .maybeSingle();

      if (existingJob) {
        logger.warn(`[AssetManager] Concurrent job lock detected for job ID: ${existingJob.id}`);
        return existingJob.id;
      }

      // 2. Set the status of the asset registry row to generating/regenerating
      const existingAsset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, assetType, mode);
      if (existingAsset) {
        await KnowledgeAssetRegistry.updateStatus(supabase, existingAsset.id, {
          status: existingAsset.status === 'outdated' ? 'regenerating' : 'generating'
        });
      } else {
        // Pre-create the asset registry row in 'generating' state
        // Wrapped in try/catch to safely ignore 23505 if a concurrent worker created it
        try {
          await supabase.from('knowledge_assets').insert({
            user_id: userId,
            document_id: documentId,
            asset_type: assetType,
            mode,
            status: 'generating',
            knowledge_version: 1,
            version: 1
          });
        } catch {
          // Benign race: concurrent worker already inserted row
        }
      }

      // 3. Create active tracking job
      const dependencies = ASSET_DEPENDENCY_GRAPH[assetType] || [];
      const { data: job, error } = await supabase
        .from('asset_generation_jobs')
        .insert({
          user_id: userId,
          document_id: documentId,
          asset_type: assetType,
          mode: modeStr,
          status: 'running',
          depends_on_types: dependencies,
          request_id: requestId,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('uq_active_generation_job')) {
          // Another concurrent worker acquired the active generation lock first.
          // Re-fetch the race winner's job ID.
          logger.info(`[AssetManager] Concurrent job lock race (23505) for Doc: ${documentId}, Type: ${assetType}. Re-fetching winner.`);
          const { data: winnerJob } = await supabase
            .from('asset_generation_jobs')
            .select('id')
            .eq('document_id', documentId)
            .eq('asset_type', assetType)
            .eq('mode', modeStr)
            .in('status', ['queued', 'running'])
            .maybeSingle();

          if (winnerJob) {
            return winnerJob.id;
          }
        }

        logger.error(`[AssetManager] Failed to create job record: ${error.message}`);
        return null;
      }

      AssetGenerationManager.logToDisk(`[JobStart] Job logged successfully with ID: ${job.id}`);
      return job.id;

    } catch (err: any) {
      logger.error(`[AssetManager] recordGenerationStart failed: ${err?.message}`);
      return null;
    }
  }

  /**
   * Records that generation has succeeded.
   * Completes the generation job and marks the asset as ready.
   */
  static async recordGenerationComplete(
    supabase: SupabaseClient,
    jobId: string,
    assetId: string
  ): Promise<void> {
    AssetGenerationManager.logToDisk(`[JobComplete] Completing Job: ${jobId}, Asset: ${assetId}`);

    try {
      const now = new Date().toISOString();

      // Complete the job record
      await supabase
        .from('asset_generation_jobs')
        .update({
          status: 'completed',
          completed_at: now,
          updated_at: now
        })
        .eq('id', jobId);

      // Make sure the asset itself is ready
      await KnowledgeAssetRegistry.updateStatus(supabase, assetId, {
        status: 'ready'
      });

      AssetGenerationManager.logToDisk(`[JobComplete] Job and Asset updated successfully.`);

    } catch (err: any) {
      logger.error(`[AssetManager] recordGenerationComplete failed: ${err?.message}`);
    }
  }

  /**
   * Records that generation has failed.
   * Marks the job as failed, marks the asset as failed, and cascades cancellation to dependents.
   */
  static async recordGenerationFailure(
    supabase: SupabaseClient,
    jobId: string,
    errorMessage: string,
    errorStage: string
  ): Promise<void> {
    AssetGenerationManager.logToDisk(`[JobFail] Failing Job: ${jobId}. Error: ${errorMessage}`, 'ERROR');

    try {
      const now = new Date().toISOString();

      // Get job details first
      const { data: job } = await supabase
        .from('asset_generation_jobs')
        .select('document_id, asset_type, user_id')
        .eq('id', jobId)
        .single();

      // Update job status to failed
      await supabase
        .from('asset_generation_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: now,
          updated_at: now
        })
        .eq('id', jobId);

      if (job) {
        // Update the asset registry row
        const existingAsset = await KnowledgeAssetRegistry.findExisting(
          supabase,
          job.document_id,
          job.asset_type as AssetType
        );

        if (existingAsset) {
          await KnowledgeAssetRegistry.markFailed(supabase, existingAsset.id, errorMessage, errorStage);
        }

        // Cascade failure to any queued dependent jobs for this document
        await AssetGenerationManager.cancelDependentJobs(supabase, job.document_id, job.asset_type as AssetType);
      }

    } catch (err: any) {
      logger.error(`[AssetManager] recordGenerationFailure failed: ${err?.message}`);
    }
  }

  /**
   * Cascades cancellation/failure downstream to any queued dependent jobs.
   */
  private static async cancelDependentJobs(
    supabase: SupabaseClient,
    documentId: string,
    failedAssetType: AssetType
  ): Promise<void> {
    AssetGenerationManager.logToDisk(`[CascadeCancel] Checking dependents of: ${failedAssetType}`);

    try {
      // Find dependent asset types
      const dependentTypes: AssetType[] = [];
      for (const [type, deps] of Object.entries(ASSET_DEPENDENCY_GRAPH)) {
        if (deps.includes(failedAssetType)) {
          dependentTypes.push(type as AssetType);
        }
      }

      if (dependentTypes.length === 0) return;

      // Update queued jobs that depend on this failed asset
      const { data: cancelledJobs } = await supabase
        .from('asset_generation_jobs')
        .update({
          status: 'cancelled',
          error_message: `Cancelled due to prerequisite asset (${failedAssetType}) failing.`,
          completed_at: new Date().toISOString()
        })
        .eq('document_id', documentId)
        .in('asset_type', dependentTypes)
        .in('status', ['queued', 'running'])
        .select('id, asset_type');

      if (cancelledJobs && cancelledJobs.length > 0) {
        for (const cJob of cancelledJobs) {
          AssetGenerationManager.logToDisk(`[CascadeCancel] Cancelled dependent job: ${cJob.id} (${cJob.asset_type})`);
          
          // Also set the asset status in the registry to failed
          const asset = await KnowledgeAssetRegistry.findExisting(supabase, documentId, cJob.asset_type as AssetType);
          if (asset) {
            await KnowledgeAssetRegistry.markFailed(
              supabase,
              asset.id,
              `Prerequisite ${failedAssetType} failed.`,
              'prerequisites'
            );
          }
        }
      }

    } catch (err: any) {
      logger.error(`[AssetManager] cancelDependentJobs failed: ${err?.message}`);
    }
  }

  // ── 3. Stale Detection & Version Outdating ────────────────────────────────────

  /**
   * Triggered when document knowledge changes (e.g. embeddings are regenerated).
   * Automatically marks all active assets for this document as 'outdated'.
   */
  static async onKnowledgeVersionChanged(
    supabase: SupabaseClient,
    userId: string,
    documentId: string,
    newVersion: number
  ): Promise<void> {
    AssetGenerationManager.logToDisk(`[VersionChanged] Outdating all assets for Doc: ${documentId} (New Version: ${newVersion})`);

    try {
      const now = new Date().toISOString();

      // Update all ready assets to 'outdated'
      const { data: updatedAssets, error } = await supabase
        .from('knowledge_assets')
        .update({
          status: 'outdated',
          knowledge_version: newVersion,
          updated_at: now
        })
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .eq('status', 'ready')
        .select('id, asset_type');

      if (error) {
        logger.error(`[AssetManager] onKnowledgeVersionChanged failed: ${error.message}`);
        return;
      }

      if (updatedAssets && updatedAssets.length > 0) {
        const typesList = updatedAssets.map(a => a.asset_type).join(', ');
        AssetGenerationManager.logToDisk(`[VersionChanged] Marked assets as outdated: ${typesList}`);
      }

    } catch (err: any) {
      logger.error(`[AssetManager] onKnowledgeVersionChanged failed: ${err?.message}`);
    }
  }

  // ── 4. Query Interface / State Map ──────────────────────────────────────────

  /**
   * Returns a complete state map of all potential asset types for a given document.
   * This is used by the frontend to render the status of the "AI Generated" collection.
   */
  static async getAssetStateMap(
    supabase: SupabaseClient,
    userId: string,
    documentId: string
  ): Promise<Record<string, any>> {
    const stateMap: Record<string, any> = {};

    try {
      // 1. Fetch all assets in registry
      const { data: assets } = await supabase
        .from('knowledge_assets')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', userId);

      // Initialize default graph states
      for (const assetType of Object.keys(ASSET_DEPENDENCY_GRAPH)) {
        stateMap[assetType] = {
          status: 'missing',
          version: 0,
          canGenerate: true,
          prerequisitesMet: true
        };
      }

      // Populate actual registry states
      if (assets) {
        for (const asset of assets) {
          const type = asset.asset_type;
          
          stateMap[type] = {
            id: asset.id,
            status: asset.status,
            version: asset.version,
            validationPassed: asset.validation_passed,
            isOutdated: asset.status === 'outdated',
            generatedAt: asset.generated_at,
            confidenceScore: asset.confidence_score,
            confidenceLabel: asset.confidence_label,
            errorMessage: asset.error_message
          };
        }
      }

      // 2. Evaluate dependency availability and canGenerate flags
      for (const [assetType, deps] of Object.entries(ASSET_DEPENDENCY_GRAPH)) {
        const state = stateMap[assetType];
        
        let prerequisitesMet = true;
        let blockedByFailure = false;

        for (const depType of deps) {
          const depState = stateMap[depType];
          if (!depState || depState.status !== 'ready') {
            prerequisitesMet = false;
          }
          if (depState && depState.status === 'failed') {
            blockedByFailure = true;
          }
        }

        state.prerequisitesMet = prerequisitesMet;
        state.canGenerate = prerequisitesMet && !blockedByFailure;
        if (blockedByFailure) {
          state.reason = `Prerequisite ${deps.find(d => stateMap[d].status === 'failed')} failed.`;
        } else if (!prerequisitesMet) {
          state.reason = `Missing prerequisites: ${deps.filter(d => stateMap[d].status !== 'ready').join(', ')}`;
        }
      }

      // 3. Enrich with any active/running background jobs details
      const { data: activeJobs } = await supabase
        .from('asset_generation_jobs')
        .select('*')
        .eq('document_id', documentId)
        .in('status', ['queued', 'running']);

      if (activeJobs) {
        for (const job of activeJobs) {
          const type = job.asset_type;
          if (stateMap[type]) {
            stateMap[type].activeJob = {
              id: job.id,
              status: job.status,
              startedAt: job.started_at || job.queued_at
            };
          }
        }
      }

    } catch (err: any) {
      logger.error(`[AssetManager] getAssetStateMap failed: ${err?.message}`);
    }

    return stateMap;
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Marks a single asset as 'outdated' in the knowledge_assets table.
   * Called when a generation_version mismatch is detected.
   * Non-blocking — logs and swallows errors so the caller can proceed.
   */
  private static async markAssetOutdated(
    supabase: SupabaseClient,
    assetId: string,
    newGenerationVersion: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('knowledge_assets')
        .update({
          status: 'outdated',
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId);

      if (error) {
        AssetGenerationManager.logToDisk(
          `[VersionCheck] Failed to mark asset [${assetId}] as outdated: ${error.message}`,
          'WARN'
        );
      } else {
        AssetGenerationManager.logToDisk(
          `[VersionCheck] Asset [${assetId}] marked as outdated (awaiting gen_v${newGenerationVersion} regeneration).`
        );
      }
    } catch (err: any) {
      AssetGenerationManager.logToDisk(
        `[VersionCheck] markAssetOutdated exception for [${assetId}]: ${err?.message}`,
        'ERROR'
      );
    }
  }

  // ── Private Disk Logging Helper ───────────────────────────────────────────────

  private static logToDisk(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    try {
      const ts = new Date().toISOString();
      const line = `[${ts}] [AssetGenerationManager] (${level}) ${message}\n`;
      fs.appendFileSync('d:/FYP Project/neuron/background_logs.txt', line);
    } catch { /* ignore */ }
  }
}
