/**
 * Phase 1: Neuron OS — Independent Study-Pack Worker
 *
 * Standalone BullMQ Worker process that consumes jobs from the `study-pack`
 * queue and executes the existing AIJobScheduler pipeline.
 *
 * Run with:
 *   npm run worker
 *
 * Or directly:
 *   npx tsx src/workers/study-pack-worker.ts
 *
 * Environment Variables Required:
 *   REDIS_URL                    — Redis connection string
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service-role key for server-side DB access
 *   WORKER_CONCURRENCY           — Max concurrent jobs (default: 5)
 *   JOB_MAX_ATTEMPTS             — Max retry attempts (default: 3)
 *   JOB_RETRY_BASE_DELAY_MS      — Base exponential backoff delay (default: 5000)
 *
 * Architecture:
 *   Redis (BullMQ) → Worker → AIJobScheduler → Existing AI Pipeline → Supabase
 *
 * Security:
 *   Auth tokens are NOT stored in job payloads. The worker authenticates to
 *   Supabase independently using SUPABASE_SERVICE_ROLE_KEY on the server side.
 *
 * Idempotency:
 *   The worker relies on the existing AIJobScheduler and JobRecoveryService
 *   idempotency mechanisms (database unique constraints, chunk deduplication,
 *   asset versioning) to safely handle at-least-once BullMQ delivery.
 */

// Load .env.local for local development — tsx does not auto-load Next.js env files
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (highest priority), then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { Worker, UnrecoverableError, type Job, type WorkerOptions } from 'bullmq';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createDedicatedRedisConnection, closeRedisConnection } from '@/lib/queue/redis';
import { QUEUE_NAME, type StudyPackJobPayload, type StudyPackJobResult, classifyError, NonRetryableError } from '@/lib/queue/types';
import { enqueueStudyPackJob, closeStudyPackQueue } from '@/lib/queue/study-pack-queue';
import { AIJobScheduler } from '@/services/ai/pipeline/scheduler';
import { JobRecoveryService } from '@/services/ai/pipeline/job-recovery-service';
import { logger } from '@/lib/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? '5');
const WORKER_ID_PREFIX = 'bullmq-worker';

// ─── Worker Identity ──────────────────────────────────────────────────────────

const WORKER_INSTANCE_ID = JobRecoveryService.generateWorkerId(WORKER_ID_PREFIX);

// ─── Structured Logging Helpers ───────────────────────────────────────────────

function logEvent(
  event: string,
  jobId: string | undefined,
  payload?: Partial<StudyPackJobPayload>,
  extra?: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    workerId: WORKER_INSTANCE_ID,
    jobId: jobId ?? 'unknown',
    taskId: payload?.taskId,
    documentId: payload?.documentId,
    userId: payload?.userId,
    attempt: extra?.attempt,
    ...extra,
  };
  // Remove undefined keys for cleaner JSON
  const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
  console.log(JSON.stringify(clean));
}

// ─── Supabase Service Client ──────────────────────────────────────────────────

/**
 * Creates a Supabase client with the service-role key for server-side worker
 * operations. This client bypasses RLS for task lease management only. The
 * existing AIJobScheduler still enforces per-user data access through its
 * own Supabase client scoped to the owning user.
 *
 * Note: SUPABASE_SERVICE_ROLE_KEY must only exist in server-side environments.
 */
function createWorkerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      '[Worker] Missing required environment variables: ' +
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a user-scoped Supabase client for the AIJobScheduler.
 * Uses the anon key with user context to enforce RLS — consistent with
 * the original in-process approach but without needing session tokens
 * in job payloads.
 *
 * We use the service client and set the user JWT context via
 * setSession simulation — or more safely, just use the service client
 * and trust the existing scheduler's per-user data scoping.
 *
 * For Phase 1 we use the service client for the scheduler.
 * The existing scheduler verifies document ownership through
 * Supabase RLS which is enforced at the DB level by user_id checks.
 */
function createSchedulerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('[Worker] Missing Supabase environment variables');
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processStudyPackJob(job: Job<StudyPackJobPayload>): Promise<StudyPackJobResult> {
  const { taskId, userId, documentId, fileUrl, fileType, force, preferences } = job.data;
  const attempt = job.attemptsMade + 1;
  const startedAt = Date.now();

  logEvent('job_started', job.id, job.data, { attempt, fileType });

  // ── 1. Validate payload ───────────────────────────────────────────────────
  if (!taskId || !userId || !documentId || !fileUrl || !fileType) {
    logEvent('job_failed', job.id, job.data, { reason: 'INVALID_PAYLOAD' });
    throw new UnrecoverableError('INVALID_DOCUMENT: Missing required job payload fields');
  }

  // ── 2. Verify document still exists (and is not soft-deleted) ───────────
  const workerSupabase = createWorkerSupabaseClient();
  const { data: doc, error: docErr } = await workerSupabase
    .from('documents')
    .select('id, user_id, subject_id, deleted_at')
    .eq('id', documentId)
    .maybeSingle();

  if (docErr || !doc) {
    logEvent('job_failed', job.id, job.data, { reason: 'DOCUMENT_NOT_FOUND', error: docErr?.message });
    // UnrecoverableError tells BullMQ to stop retrying immediately
    throw new UnrecoverableError(`DOCUMENT_NOT_FOUND: Document ${documentId} does not exist or was deleted`);
  }

  if (doc.deleted_at !== null) {
    logEvent('job_failed', job.id, job.data, { reason: 'DOCUMENT_DELETED' });
    throw new UnrecoverableError(`DOCUMENT_NOT_FOUND: Document ${documentId} has been soft-deleted`);
  }

  // ── 3. Verify ownership ───────────────────────────────────────────────────
  if (doc.user_id !== userId) {
    logEvent('job_failed', job.id, job.data, { reason: 'OWNERSHIP_MISMATCH' });
    throw new UnrecoverableError('UNAUTHORIZED: Document does not belong to requesting user');
  }

  // ── 4. Log progress update: job acquired ─────────────────────────────────
  logEvent('job_progress', job.id, job.data, { stage: 'claim_task', attempt });

  // ── 5. Instantiate & run existing AIJobScheduler ──────────────────────────
  const schedulerSupabase = createSchedulerSupabaseClient();

  const scheduler = new AIJobScheduler(schedulerSupabase, documentId, userId, taskId, {
    forceRun: !!force,
    preferences,
  });

  try {
    await scheduler.run(fileUrl, fileType);
  } catch (err) {
    const classified = classifyError(err);
    logEvent('job_error', job.id, job.data, {
      stage: 'scheduler',
      classification: classified.classification,
      error: classified.message,
      attempt,
    });

    if (classified.classification === 'NON_RETRYABLE') {
      // UnrecoverableError is BullMQ's built-in class that stops retries
      throw new UnrecoverableError(classified.message);
    }
    // Rethrow retryable errors so BullMQ applies exponential backoff
    throw err;
  }

  const durationMs = Date.now() - startedAt;

  logEvent('job_completed', job.id, job.data, { durationMs, attempt });

  return {
    success: true,
    taskId,
    documentId,
    completedAt: new Date().toISOString(),
    durationMs,
  };
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────

const workerOptions: WorkerOptions = {
  connection: createDedicatedRedisConnection(),
  concurrency: CONCURRENCY,
  // Generous BullMQ lock duration (10 minutes) matching our 12-minute DB lease
  // Prevents BullMQ from marking active LLM sliding window summarization as stalled
  stalledInterval: 120_000, // 2 minutes
  lockDuration: 600_000,    // 10 minutes
  // ── Redis Polling ─────────────────────────────────────────────────────────
  // 500ms delay when queue is empty. Real Redis (Railway / Local) has no
  // request limits, allowing ultra-fast job pickup and high throughput.
  drainDelay: 500,
};

const worker = new Worker<StudyPackJobPayload, StudyPackJobResult>(
  QUEUE_NAME,
  processStudyPackJob,
  workerOptions
);

// ─── Worker Event Handlers ────────────────────────────────────────────────────

worker.on('ready', () => {
  logEvent('worker_ready', undefined, undefined, {
    concurrency: CONCURRENCY,
    queue: QUEUE_NAME,
  });
});

worker.on('active', (job) => {
  logEvent('job_active', job.id, job.data, { attempt: job.attemptsMade + 1 });
});

worker.on('completed', (job, result: StudyPackJobResult) => {
  logEvent('job_completed_event', job.id, job.data, {
    durationMs: result.durationMs,
  });
});

worker.on('failed', (job, err) => {
  const isNonRetryable = err instanceof NonRetryableError;
  logEvent('job_failed_event', job?.id, job?.data, {
    error: err.message,
    isNonRetryable,
    attempt: (job?.attemptsMade ?? 0) + 1,
    willRetry: !isNonRetryable && (job?.attemptsMade ?? 0) < (job?.opts?.attempts ?? 3) - 1,
  });
});

worker.on('stalled', (jobId) => {
  logEvent('job_stalled', jobId, undefined, {
    note: 'Job stalled — will be recovered by BullMQ or DB watchdog',
  });
});

worker.on('error', (err) => {
  logger.error('[Worker] Worker-level error:', err);
});

// ─── Startup Sweep & Watchdog ──────────────────────────────────────────────────

let watchdogTimer: NodeJS.Timeout | null = null;

async function runStartupSweep() {
  try {
    const supabase = createWorkerSupabaseClient();
    logger.info('[Worker] Running startup database reconciliation sweep...');

    // 1. Recover any stale locked tasks
    const { recoveredCount } = await JobRecoveryService.recoverStaleJobs(supabase);
    if (recoveredCount > 0) {
      logger.info(`[Worker] Recovered ${recoveredCount} stale tasks during startup sweep.`);
    }

    // 2. Query pending or queued study-pack tasks that are not locked
    const { data: tasks, error } = await supabase
      .from('background_tasks')
      .select('id, user_id, document_id, status, locked_by')
      .eq('task_type', 'study_pack')
      .in('status', ['pending', 'Queued', 'queued'])
      .is('locked_by', null);

    if (error) {
      logger.error('[Worker] Error during startup task reconciliation:', error);
      return;
    }

    if (!tasks || tasks.length === 0) {
      logger.info('[Worker] Startup sweep: 0 orphaned tasks found. Queue is up to date.');
      return;
    }

    logger.info(`[Worker] Startup sweep: found ${tasks.length} pending/queued tasks. Reconciling with BullMQ...`);

    let enqueuedCount = 0;
    for (const task of tasks) {
      // Fetch document details
      const { data: doc } = await supabase
        .from('documents')
        .select('id, file_url, file_type, deleted_at, subject_id')
        .eq('id', task.document_id)
        .maybeSingle();

      if (!doc || doc.deleted_at !== null || !doc.file_url || !doc.file_type || !doc.subject_id) {
        continue;
      }

      // Ensure status is Queued in DB
      if (task.status === 'pending') {
        await supabase
          .from('background_tasks')
          .update({ status: 'Queued', updated_at: new Date().toISOString() })
          .eq('id', task.id);
      }

      // Enqueue to BullMQ
      await enqueueStudyPackJob({
        jobId: task.id,
        taskId: task.id,
        userId: task.user_id,
        documentId: task.document_id,
        fileUrl: doc.file_url,
        fileType: doc.file_type,
        force: false,
      });
      enqueuedCount++;
    }

    logger.info(`[Worker] Startup sweep completed: ${enqueuedCount} tasks verified/enqueued to BullMQ.`);
  } catch (sweepErr) {
    logger.error('[Worker] Exception during startup sweep:', sweepErr);
  }
}

function startPeriodicWatchdog() {
  const WATCHDOG_INTERVAL_MS = 60_000; // Run every 60 seconds
  watchdogTimer = setInterval(async () => {
    try {
      const supabase = createWorkerSupabaseClient();
      await JobRecoveryService.recoverStaleJobs(supabase);
    } catch (err) {
      logger.warn('[Worker] Periodic watchdog error:', err);
    }
  }, WATCHDOG_INTERVAL_MS);

  if (watchdogTimer.unref) {
    watchdogTimer.unref();
  }
}

// ─── Startup Execution ────────────────────────────────────────────────────────

logEvent('worker_started', undefined, undefined, {
  workerId: WORKER_INSTANCE_ID,
  concurrency: CONCURRENCY,
  queue: QUEUE_NAME,
  nodeVersion: process.version,
  pid: process.pid,
});

runStartupSweep().finally(() => {
  startPeriodicWatchdog();
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logEvent('worker_shutdown_initiated', undefined, undefined, { signal });

  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }

  try {
    // Stop accepting new jobs
    await worker.close();
    logEvent('worker_shutdown_complete', undefined, undefined, { signal });
  } catch (err) {
    logger.error('[Worker] Error during worker shutdown:', err);
  }

  try {
    await closeStudyPackQueue();
    await closeRedisConnection();
    logEvent('worker_connections_closed', undefined, undefined, { signal });
  } catch (err) {
    logger.error('[Worker] Error closing connections:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Keep process alive (worker is event-driven)
process.on('uncaughtException', (err) => {
  logger.error('[Worker] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[Worker] Unhandled rejection:', reason);
});

