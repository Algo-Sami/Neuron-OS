/**
 * Phase 1: BullMQ Queue Type Definitions
 *
 * Contains strongly-typed job payloads and related contracts for the
 * study-pack queue. Deliberately excludes sensitive auth tokens from
 * the Redis payload — the worker authenticates independently using
 * server-side environment variables.
 */

import type { UserPreferences } from '@/lib/preferences';

// ─── Queue & Job Names ────────────────────────────────────────────────────────

export const QUEUE_NAME = 'study-pack' as const;

export type QueueName = typeof QUEUE_NAME;

// ─── Job Types ────────────────────────────────────────────────────────────────

export type JobType = 'study_pack';

// ─── Study Pack Job Payload ───────────────────────────────────────────────────

/**
 * The payload serialized into Redis for each study-pack job.
 *
 * SECURITY NOTE: Do NOT add auth tokens, API keys, service-role keys, passwords,
 * or any other secrets to this payload. Redis payloads may be inspected by queue
 * dashboards. The worker authenticates to Supabase via server-side environment
 * variables and a service-role client.
 */
export interface StudyPackJobPayload {
  /** Stable BullMQ job identity key (matches taskId for deduplication, e.g. studypack__<uuid>) */
  jobId: string;

  /** Background task row ID in `public.background_tasks` */
  taskId: string;

  /** Document owner user ID (UUID) */
  userId: string;

  /** Target document ID (UUID) in `public.documents` */
  documentId: string;

  /** Storage URL of the raw uploaded file */
  fileUrl: string;

  /** MIME-type or extension used for extractor routing (e.g. 'pdf', 'docx') */
  fileType: string;

  /** When true, forces regeneration even if valid assets already exist */
  force?: boolean;

  /** User interface preferences (theme, AI-auto settings, etc.) — non-sensitive */
  preferences?: UserPreferences;

  /** ISO-8601 timestamp when the job was enqueued */
  enqueuedAt: string;

  /** AI generation manifest version — used for idempotency / asset invalidation */
  generationVersion: number;
}

// ─── Job Result ───────────────────────────────────────────────────────────────

export interface StudyPackJobResult {
  success: boolean;
  taskId: string;
  documentId: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}

// ─── Error Classification ─────────────────────────────────────────────────────

/**
 * Retryable errors: transient conditions that a retry may resolve.
 * Non-retryable errors: permanent failures — retrying would waste resources.
 */
export type ErrorClassification = 'RETRYABLE' | 'NON_RETRYABLE';

export interface ClassifiedError {
  classification: ErrorClassification;
  message: string;
  code?: string;
}

/**
 * Classify an error to determine whether BullMQ should retry the job.
 * Throws a special marker that the worker can inspect.
 */
export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;

  // Non-retryable: deterministic validation / auth / format errors
  const nonRetryablePatterns = [
    'UNSUPPORTED_FILE_TYPE',
    'INVALID_DOCUMENT',
    'DOCUMENT_NOT_FOUND',
    'UNAUTHORIZED',
    'DOCUMENT_TOO_SHORT',
    'DOCUMENT_TOO_SMALL',
    'TEXT_VALIDATION_FAILED',
    'MAX_ATTEMPTS_EXCEEDED',
    'LEASE_LOST',
  ];

  for (const pattern of nonRetryablePatterns) {
    if (message.includes(pattern)) {
      return { classification: 'NON_RETRYABLE', message, code };
    }
  }

  // Retryable: rate limits, timeouts, network issues, transient provider errors
  const retryablePatterns = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    '429',
    '503',
    '504',
    'rate limit',
    'timeout',
    'RESOURCE_EXHAUSTED',
    'overloaded',
  ];

  for (const pattern of retryablePatterns) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return { classification: 'RETRYABLE', message, code };
    }
  }

  // Default: treat unknown errors as retryable to avoid permanent data loss
  return { classification: 'RETRYABLE', message, code };
}

/**
 * Marker class that workers throw when they want to prevent BullMQ retries.
 */
export class NonRetryableError extends Error {
  public readonly classification = 'NON_RETRYABLE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}
