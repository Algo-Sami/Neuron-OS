/**
 * Phase 1: BullMQ Study-Pack Queue
 *
 * Wraps the BullMQ Queue for study-pack job dispatch.
 * Provides:
 *  - enqueueStudyPackJob: idempotent enqueue with stable jobId deduplication key
 *  - getStudyPackQueue: singleton queue accessor
 *  - closeStudyPackQueue: graceful shutdown
 *
 * Job Configuration:
 *  - Attempts: JOB_MAX_ATTEMPTS (default 3), configurable via env
 *  - Backoff: exponential starting at JOB_RETRY_BASE_DELAY_MS (default 5000ms)
 *  - Completed jobs retained for 2 hours, failed jobs for 48 hours
 */

import { Queue, type JobsOptions } from 'bullmq';
import { getRedisConnection } from './redis';
import { QUEUE_NAME, type StudyPackJobPayload } from './types';
import { AI_GENERATION_VERSION } from '@/services/ai/pipeline/ai-version-manifest';
import { logger } from '@/lib/logger';

// ─── Configuration (from environment) ────────────────────────────────────────

const MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS ?? '3');
const BASE_DELAY_MS = Number(process.env.JOB_RETRY_BASE_DELAY_MS ?? '5000');

// Keep completed jobs 2h, failed jobs 48h — prevents unbounded Redis growth
const COMPLETED_RETENTION_SECONDS = 2 * 60 * 60;
const FAILED_RETENTION_SECONDS = 48 * 60 * 60;

// ─── Singleton Queue ──────────────────────────────────────────────────────────

let queueInstance: Queue<StudyPackJobPayload> | null = null;

/**
 * Returns the shared BullMQ Queue instance, creating it on first call.
 */
export function getStudyPackQueue(): Queue<StudyPackJobPayload> {
  if (queueInstance) return queueInstance;

  queueInstance = new Queue<StudyPackJobPayload>(QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: BASE_DELAY_MS,
      },
      removeOnComplete: { age: COMPLETED_RETENTION_SECONDS, count: 1000 },
      removeOnFail: { age: FAILED_RETENTION_SECONDS, count: 500 },
    },
  });

  logger.info(`[Queue] study-pack queue initialized (maxAttempts=${MAX_ATTEMPTS}, baseDelay=${BASE_DELAY_MS}ms)`);

  return queueInstance;
}

/**
 * Closes the queue connection gracefully. Call during application shutdown.
 */
export async function closeStudyPackQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
    logger.info('[Queue] study-pack queue closed');
  }
}

// ─── Enqueue Helper ───────────────────────────────────────────────────────────

export interface EnqueueResult {
  jobId: string;
  deduplicated: boolean; // true when an equivalent job already exists
}

/**
 * Enqueues a study-pack generation job with stable deduplication.
 *
 * Uses a deterministic jobId keyed on `taskId` so that concurrent callers
 * always refer to the same BullMQ job. BullMQ skips duplicate inserts when
 * a job with the same jobId is already waiting or active.
 *
 * Deduplication key format: `study-pack:{taskId}`
 */
export async function enqueueStudyPackJob(
  params: Omit<StudyPackJobPayload, 'enqueuedAt' | 'generationVersion'>
): Promise<EnqueueResult> {
  const queue = getStudyPackQueue();

  const stableJobId = `studypack__${params.taskId}`;

  // Check whether a job already exists in BullMQ with this identity
  const existing = await queue.getJob(stableJobId);
  if (existing) {
    const state = await existing.getState();
    // If it's waiting, delayed, or active — it's already handled. Don't re-add.
    if (state === 'waiting' || state === 'delayed' || state === 'active') {
      logger.info(`[Queue] Job ${stableJobId} already exists in state=${state}. Skipping duplicate enqueue.`);
      return { jobId: stableJobId, deduplicated: true };
    }
  }

  const payload: StudyPackJobPayload = {
    ...params,
    enqueuedAt: new Date().toISOString(),
    generationVersion: AI_GENERATION_VERSION,
  };

  const jobOptions: JobsOptions = {
    jobId: stableJobId, // stable deduplication key
  };

  const job = await queue.add('generate', payload, jobOptions);

  logger.info(`[Queue] Enqueued study-pack job ${job.id} for document=${params.documentId} task=${params.taskId}`);

  return { jobId: job.id ?? stableJobId, deduplicated: false };
}
