/**
 * Study Pack Dispatcher Service
 *
 * Centralized, idempotent dispatcher for study-pack generation jobs.
 * Handles:
 *  1. Watchdog auto-recovery of stale jobs
 *  2. Database task state transition (pending -> Queued)
 *  3. Concurrent race-condition resolution (Postgres 23505)
 *  4. BullMQ queue enqueueing with stable deduplication key
 *
 * Reusable across:
 *  - Server Actions (saveUploadMetadata)
 *  - API Routes (POST /api/generate-study-pack)
 *  - Worker Startup Sweep / Recovery
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences } from '@/lib/preferences';
import { logger } from '@/lib/logger';
import { JobRecoveryService } from './job-recovery-service';
import { enqueueStudyPackJob } from '@/lib/queue/study-pack-queue';
import * as crypto from 'crypto';

export interface DispatchParams {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
  fileUrl: string;
  fileType: string;
  force?: boolean;
  preferences?: UserPreferences;
}

export interface DispatchResult {
  success: boolean;
  taskId?: string;
  jobId?: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rate_limited' | 'error';
  deduplicated?: boolean;
  code?: string;
  cooldownUntil?: string;
  message?: string;
  error?: string;
}

const PENDING_STATUS = 'pending';
const QUEUED_STATUS = 'Queued';

export async function dispatchStudyPackGeneration(params: DispatchParams): Promise<DispatchResult> {
  const { supabase, userId, documentId, fileUrl, fileType, force, preferences } = params;

  try {
    // 1. Verify document exists, belongs to user, and has subject assigned
    let doc: any = null;
    const { data: extDoc, error: extErr } = await supabase
      .from('documents')
      .select('id, subject_id, ai_topic, folder_id, ai_cooldown_until, folders(name)')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (extErr && (extErr.code === 'PGRST204' || extErr.message?.includes('ai_cooldown_until') || extErr.message?.includes('column'))) {
      // Graceful fallback if migration 20260902 has not been applied yet
      const { data: baseDoc, error: baseErr } = await supabase
        .from('documents')
        .select('id, subject_id, ai_topic, folder_id, folders(name)')
        .eq('id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (baseErr || !baseDoc) {
        logger.error('[Dispatcher] Failed to fetch document (base fallback): ' + (baseErr?.message || 'Not found'));
        return { success: false, status: 'error', error: 'Document not found' };
      }
      doc = baseDoc;
    } else if (extErr || !extDoc) {
      logger.error('[Dispatcher] Failed to fetch document: ' + (extErr?.message || 'Not found'));
      return { success: false, status: 'error', error: 'Document not found' };
    } else {
      doc = extDoc;
    }

    // Server-Side Cooldown Guard
    if (doc.ai_cooldown_until && new Date(doc.ai_cooldown_until) > new Date()) {
      logger.warn(`[Dispatcher] Rejecting dispatch for document "${documentId}" — cooldown active until ${doc.ai_cooldown_until}`);
      return {
        success: false,
        status: 'rate_limited',
        code: 'AI_COOLDOWN_ACTIVE',
        cooldownUntil: doc.ai_cooldown_until,
        message: `AI rate limit cooldown is active. Please wait until ${doc.ai_cooldown_until} before retrying.`,
        error: 'AI_COOLDOWN_ACTIVE'
      };
    }

    if (!doc.subject_id) {
      logger.info(`[Dispatcher] Skipping study pack dispatch for document "${documentId}" — subject not yet assigned.`);
      return {
        success: true,
        status: 'completed',
        message: 'Skipping AI study pack — document has no subject assigned yet. Processing will start after subject confirmation.',
      };
    }

    // Check if the document belongs to a Lectures folder
    const folderName = (doc.folders as any)?.name || doc.ai_topic || '';
    const isLectureFolder = !folderName || /lecture/i.test(folderName);

    if (!isLectureFolder && !force) {
      logger.info(`[Dispatcher] Skipping study pack dispatch for document "${documentId}" — folder is "${folderName}" (not a lecture).`);
      return {
        success: true,
        status: 'completed',
        message: `Skipping AI study pack — document is in "${folderName}" folder (only Lectures trigger automatic AI study packs).`,
      };
    }

    // 2. Run stale jobs recovery watchdog (non-blocking failure)
    try {
      await JobRecoveryService.recoverStaleJobs(supabase, userId);
    } catch (watchdogErr) {
      logger.warn('[Dispatcher] Watchdog recovery error (non-fatal):', watchdogErr);
    }

    // 3. Check existing background_tasks row
    const { data: existing } = await supabase
      .from('background_tasks')
      .select('id, status')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .eq('task_type', 'study_pack')
      .maybeSingle();

    let taskId: string;
    let shouldDispatch = false;

    if (!existing) {
      // Create new task record
      taskId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from('background_tasks').insert({
        id: taskId,
        user_id: userId,
        document_id: documentId,
        task_type: 'study_pack',
        status: QUEUED_STATUS,
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Race condition: another concurrent caller inserted the task row
          const { data: raceWinner, error: refetchErr } = await supabase
            .from('background_tasks')
            .select('id, status')
            .eq('user_id', userId)
            .eq('document_id', documentId)
            .eq('task_type', 'study_pack')
            .maybeSingle();

          if (refetchErr || !raceWinner) {
            logger.error('[Dispatcher] Failed to refetch task after 23505 race: ' + (refetchErr?.message ?? 'not found'));
            return { success: false, status: 'error', error: 'Task creation conflict — please retry' };
          }

          taskId = raceWinner.id;
          const raceNormalized = (raceWinner.status || '').toLowerCase().trim();

          if (raceNormalized === PENDING_STATUS || raceNormalized === 'queued') {
            if (raceNormalized === PENDING_STATUS) {
              await supabase
                .from('background_tasks')
                .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
                .eq('id', taskId);
              shouldDispatch = true;
            } else {
              // Already queued in DB, ensure it is also queued in BullMQ
              shouldDispatch = true;
            }
          } else if (raceNormalized === 'completed') {
            return { success: true, taskId, status: 'completed', message: 'Already completed' };
          } else if (raceNormalized === 'failed' && !force) {
            return { success: false, taskId, status: 'failed', message: 'Task failed previously' };
          } else if (raceNormalized === 'cancelled') {
            return { success: false, taskId, status: 'cancelled', message: 'Task cancelled' };
          } else {
            return { success: true, taskId, status: 'processing', message: 'Already processing' };
          }
        } else {
          logger.error('[Dispatcher] background_tasks insert failed: ' + insertErr.message);
          return { success: false, status: 'error', error: insertErr.message };
        }
      } else {
        shouldDispatch = true;
      }
    } else {
      taskId = existing.id;
      const rawStatus = existing.status || '';
      const normalizedStatus = rawStatus.toLowerCase().trim();

      if (force) {
        await supabase
          .from('background_tasks')
          .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
          .eq('id', taskId);
        shouldDispatch = true;
      } else if (normalizedStatus === PENDING_STATUS) {
        await supabase
          .from('background_tasks')
          .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
          .eq('id', taskId);
        shouldDispatch = true;
      } else if (normalizedStatus === 'queued') {
        // Safe to ensure enqueued in BullMQ
        shouldDispatch = true;
      } else if (normalizedStatus === 'completed') {
        return { success: true, taskId, status: 'completed', message: 'Already completed' };
      } else if (normalizedStatus === 'failed') {
        return { success: false, taskId, status: 'failed', message: 'Task failed previously' };
      } else if (normalizedStatus === 'cancelled') {
        return { success: false, taskId, status: 'cancelled', message: 'Task cancelled' };
      } else {
        return { success: true, taskId, status: 'processing', message: 'Already processing' };
      }
    }

    if (!shouldDispatch) {
      return { success: true, taskId, status: 'queued' };
    }

    // 4. Enqueue to BullMQ
    const { jobId, deduplicated } = await enqueueStudyPackJob({
      jobId: taskId,
      taskId,
      userId,
      documentId,
      fileUrl,
      fileType,
      force: !!force,
      preferences,
    });

    logger.info(`[Dispatcher] Task ${taskId} enqueued as BullMQ job ${jobId} (deduplicated=${deduplicated})`);

    return {
      success: true,
      taskId,
      jobId,
      status: 'queued',
      deduplicated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Dispatcher] Dispatch error:', err);
    return {
      success: false,
      status: 'error',
      error: errorMsg,
    };
  }
}
