import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  JOB_LEASE_DURATION_MS,
  JOB_MAX_ATTEMPTS,
  ASSET_JOB_LEASE_DURATION_MS,
  ACTIVE_PIPELINE_STATUSES
} from './recovery-constants';

export interface TaskClaimResult {
  success: boolean;
  reason?: 'ALREADY_LOCKED' | 'NOT_FOUND' | 'TERMINAL_STATE' | 'MAX_ATTEMPTS_EXCEEDED' | 'DB_ERROR';
  workerId?: string;
  lockedBy?: string;
  attempts?: number;
}

export class JobRecoveryService {
  /**
   * Generates a unique worker ID for an execution instance.
   */
  static generateWorkerId(prefix: string = 'study-pack-worker'): string {
    const rand = Math.random().toString(36).substring(2, 10);
    return `${prefix}:${Date.now()}:${rand}`;
  }

  /**
   * Atomically claims a task for a worker.
   * Ensures that two concurrent workers cannot both claim the same task with a valid lease.
   */
  static async claimTask(
    supabase: SupabaseClient,
    taskId: string,
    workerId: string,
    leaseDurationMs: number = JOB_LEASE_DURATION_MS
  ): Promise<TaskClaimResult> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + leaseDurationMs);

      // Fetch task to inspect current state & lease
      const { data: task, error: fetchErr } = await supabase
        .from('background_tasks')
        .select('id, status, locked_by, lock_expires_at, attempts, max_attempts, started_at, user_id, document_id')
        .eq('id', taskId)
        .maybeSingle();

      if (fetchErr || !task) {
        logger.error(`[JobRecovery] Failed to fetch task ${taskId} for claim: ${fetchErr?.message || 'Task not found'}`);
        return { success: false, reason: 'NOT_FOUND' };
      }

      const rawStatus = (task.status || '').toLowerCase().trim();
      if (rawStatus === 'completed' || rawStatus === 'cancelled') {
        return { success: false, reason: 'TERMINAL_STATE' };
      }

      // Check if active lease is already held by another worker
      if (task.locked_by && task.lock_expires_at) {
        const leaseExpiry = new Date(task.lock_expires_at);
        if (leaseExpiry.getTime() > now.getTime() && task.locked_by !== workerId) {
          logger.info(
            `[JobRecovery] Task ${taskId} is currently locked by ${task.locked_by} until ${task.lock_expires_at}. Claim rejected.`
          );
          return { success: false, reason: 'ALREADY_LOCKED', lockedBy: task.locked_by };
        }
      }

      const currentAttempts = task.attempts ?? 0;
      const maxAttempts = task.max_attempts ?? JOB_MAX_ATTEMPTS;

      if (currentAttempts >= maxAttempts) {
        logger.warn(`[JobRecovery] Task ${taskId} exceeded max attempts (${currentAttempts}/${maxAttempts}). Claim rejected.`);
        return { success: false, reason: 'MAX_ATTEMPTS_EXCEEDED', attempts: currentAttempts };
      }

      // Perform atomic lease acquisition
      const { data: updated, error: updateErr } = await supabase
        .from('background_tasks')
        .update({
          locked_by: workerId,
          heartbeat_at: now.toISOString(),
          lock_expires_at: expiresAt.toISOString(),
          attempts: currentAttempts + 1,
          started_at: task.started_at || now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', taskId)
        .select('id, locked_by, attempts')
        .maybeSingle();

      if (updateErr || !updated) {
        logger.error(`[JobRecovery] Atomic claim failed for task ${taskId}: ${updateErr?.message}`);
        return { success: false, reason: 'DB_ERROR' };
      }

      logger.info(`[JobRecovery] Task ${taskId} successfully claimed by worker ${workerId} (Attempt ${updated.attempts})`);
      return { success: true, workerId, attempts: updated.attempts };

    } catch (err: any) {
      logger.error(`[JobRecovery] Exception during claimTask for ${taskId}: ${err?.message}`);
      return { success: false, reason: 'DB_ERROR' };
    }
  }

  /**
   * Periodically updates heartbeat_at and extends lock_expires_at for the owning worker.
   * Returns false if the worker no longer owns the lease.
   */
  static async sendHeartbeat(
    supabase: SupabaseClient,
    taskId: string,
    workerId: string,
    leaseDurationMs: number = JOB_LEASE_DURATION_MS
  ): Promise<boolean> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + leaseDurationMs);

      const { data, error } = await supabase
        .from('background_tasks')
        .update({
          heartbeat_at: now.toISOString(),
          lock_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', taskId)
        .eq('locked_by', workerId)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        logger.warn(
          `[JobRecovery] Heartbeat failed for task ${taskId} (worker: ${workerId}). Worker may have lost lease.`
        );
        return false;
      }

      return true;
    } catch (err: any) {
      logger.warn(`[JobRecovery] Heartbeat exception for task ${taskId}: ${err?.message}`);
      return false;
    }
  }

  /**
   * Marks a task as Completed and releases worker lease atomically.
   */
  static async completeTask(
    supabase: SupabaseClient,
    taskId: string,
    workerId: string,
    progressState?: any,
    logs?: any[]
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const payload: any = {
        status: 'Completed',
        locked_by: null,
        heartbeat_at: null,
        lock_expires_at: null,
        completed_at: now,
        updated_at: now
      };

      if (progressState) payload.progress = progressState;
      if (logs) payload.logs = logs;

      const { error } = await supabase
        .from('background_tasks')
        .update(payload)
        .eq('id', taskId)
        .eq('locked_by', workerId);

      if (error) {
        logger.error(`[JobRecovery] Failed to complete task ${taskId}: ${error.message}`);
        return false;
      }

      logger.info(`[JobRecovery] Task ${taskId} marked Completed by worker ${workerId}.`);
      return true;
    } catch (err: any) {
      logger.error(`[JobRecovery] Exception completing task ${taskId}: ${err?.message}`);
      return false;
    }
  }

  /**
   * Handles task failure and releases the lease.
   */
  static async failTask(
    supabase: SupabaseClient,
    taskId: string,
    workerId: string,
    errorMessage: string,
    progressState?: any,
    logs?: any[]
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const payload: any = {
        status: 'Failed',
        locked_by: null,
        heartbeat_at: null,
        lock_expires_at: null,
        updated_at: now
      };

      if (progressState) {
        progressState.overallStatus = 'failed';
        progressState.errorMessage = errorMessage;
        payload.progress = progressState;
      }
      if (logs) payload.logs = logs;

      await supabase
        .from('background_tasks')
        .update(payload)
        .eq('id', taskId)
        .eq('locked_by', workerId);

      logger.error(`[JobRecovery] Task ${taskId} marked Failed by worker ${workerId}. Error: ${errorMessage}`);
    } catch (err: any) {
      logger.error(`[JobRecovery] Exception failing task ${taskId}: ${err?.message}`);
    }
  }

  /**
   * Watchdog: Scans and recovers stale jobs whose lease has expired while in an active processing state.
   * If attempts < max_attempts -> resets to 'Queued' to allow another worker to pick it up.
   * If attempts >= max_attempts -> marks as 'Failed' permanently.
   */
  static async recoverStaleJobs(
    supabase: SupabaseClient,
    userId?: string
  ): Promise<{ recoveredCount: number; failedCount: number }> {
    let recoveredCount = 0;
    let failedCount = 0;

    try {
      const now = new Date().toISOString();

      let query = supabase
        .from('background_tasks')
        .select('id, user_id, document_id, status, locked_by, heartbeat_at, lock_expires_at, attempts, max_attempts')
        .in('status', ACTIVE_PIPELINE_STATUSES as unknown as string[])
        .not('lock_expires_at', 'is', null)
        .lt('lock_expires_at', now);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: staleTasks, error } = await query;

      if (error) {
        logger.error(`[JobRecovery] Watchdog error querying stale tasks: ${error.message}`);
        return { recoveredCount: 0, failedCount: 0 };
      }

      if (!staleTasks || staleTasks.length === 0) {
        return { recoveredCount: 0, failedCount: 0 };
      }

      logger.info(`[JobRecovery] Watchdog found ${staleTasks.length} stale background tasks.`);

      for (const task of staleTasks) {
        const attempts = task.attempts ?? 0;
        const maxAttempts = task.max_attempts ?? JOB_MAX_ATTEMPTS;

        logger.info(
          `[JobRecovery] Stale task detected: taskId=${task.id}, documentId=${task.document_id}, ` +
          `previousStatus=${task.status}, previousWorker=${task.locked_by}, ` +
          `lastHeartbeat=${task.heartbeat_at}, leaseExpiredAt=${task.lock_expires_at}, attempts=${attempts}/${maxAttempts}`
        );

        if (attempts >= maxAttempts) {
          // Permanently fail
          const { error: failErr } = await supabase
            .from('background_tasks')
            .update({
              status: 'Failed',
              locked_by: null,
              heartbeat_at: null,
              lock_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id)
            .eq('lock_expires_at', task.lock_expires_at); // Concurrency guard

          if (!failErr) {
            failedCount++;
            logger.warn(
              `[JobRecovery] Task permanently failed: taskId=${task.id}, attempts=${attempts}, reason=Maximum retry attempts exceeded after stale worker recovery.`
            );
          }
        } else {
          // Re-queue for next worker
          const { error: reqErr } = await supabase
            .from('background_tasks')
            .update({
              status: 'Queued',
              locked_by: null,
              heartbeat_at: null,
              lock_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id)
            .eq('lock_expires_at', task.lock_expires_at); // Concurrency guard

          if (!reqErr) {
            recoveredCount++;
            logger.info(`[JobRecovery] Task re-queued: taskId=${task.id}, attempt=${attempts}/${maxAttempts}`);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[JobRecovery] Watchdog exception during recoverStaleJobs: ${err?.message}`);
    }

    return { recoveredCount, failedCount };
  }

  /**
   * Watchdog for orphaned asset_generation_jobs.
   * If a job has been in status 'running' longer than ASSET_JOB_LEASE_DURATION_MS without completion,
   * marks it as 'failed' so future generation attempts are not permanently blocked.
   */
  static async recoverStaleAssetJobs(
    supabase: SupabaseClient,
    documentId?: string
  ): Promise<number> {
    let recoveredCount = 0;
    try {
      const staleThreshold = new Date(Date.now() - ASSET_JOB_LEASE_DURATION_MS).toISOString();

      let query = supabase
        .from('asset_generation_jobs')
        .select('id, document_id, asset_type, started_at')
        .eq('status', 'running')
        .lt('started_at', staleThreshold);

      if (documentId) {
        query = query.eq('document_id', documentId);
      }

      const { data: staleJobs, error } = await query;

      if (error || !staleJobs || staleJobs.length === 0) {
        return 0;
      }

      logger.warn(`[JobRecovery] Found ${staleJobs.length} stale asset generation jobs.`);

      for (const job of staleJobs) {
        const { error: updateErr } = await supabase
          .from('asset_generation_jobs')
          .update({
            status: 'failed',
            error_message: 'Generation timed out or worker crashed (stale lock recovered).',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id)
          .eq('status', 'running');

        if (!updateErr) {
          recoveredCount++;
          logger.info(`[JobRecovery] Recovered stale asset_generation_job ${job.id} for document ${job.document_id} (${job.asset_type})`);
        }
      }
    } catch (err: any) {
      logger.error(`[JobRecovery] Exception recovering stale asset generation jobs: ${err?.message}`);
    }

    return recoveredCount;
  }
}
