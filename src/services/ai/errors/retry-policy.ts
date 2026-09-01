/**
 * Reusable AI Retry Policy & Backoff Execution Engine — Phase 2
 *
 * Implements:
 * - Exponential backoff schedule: Attempt 1 (0s), Attempt 2 (~5s), Attempt 3 (~15s), Attempt 4 (~30s)
 * - 0–1500ms randomized jitter to prevent thundering herds
 * - Strict prioritization of provider Retry-After headers / delays
 * - Immediate abort on non-retryable errors (auth, bad request, quota exhaustion)
 * - Structured telemetry logging
 */

import { AIRetryConfig, NormalizedAIError, RetryAttemptLog } from './ai-error-types';
import { normalizeAIError } from './ai-error-normalizer';
import { logger } from '@/lib/logger';

export const DEFAULT_RETRY_CONFIG: AIRetryConfig = {
  maxAttempts: 4, // 1 initial + 3 retries
  baseDelaysMs: [0, 5000, 15000, 30000],
  jitterMs: 1500,
  defaultCooldownMs: 60000,
};

export interface RetryContext {
  documentId?: string;
  jobId?: string;
  operation?: string;
  userId?: string;
  providerName?: string;
}

export interface RetryCallbacks {
  onRetry?: (
    attempt: number,
    delayMs: number,
    normalizedError: NormalizedAIError,
    context: RetryContext
  ) => void | Promise<void>;
  sleepFn?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates backoff delay with jitter and provider header priority.
 */
export function calculateBackoffDelay(
  attempt: number,
  normalizedError: NormalizedAIError,
  config: AIRetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // If provider gave explicit retry-after duration, prioritize it
  if (normalizedError.retryAfterMs && normalizedError.retryAfterMs > 0) {
    const jitter = Math.floor(Math.random() * 500); // Small 0-500ms jitter for provider delays
    return normalizedError.retryAfterMs + jitter;
  }

  const baseDelays = config.baseDelaysMs || DEFAULT_RETRY_CONFIG.baseDelaysMs;
  const jitterMax = typeof config.jitterMs === 'number' ? config.jitterMs : DEFAULT_RETRY_CONFIG.jitterMs;

  const baseIndex = Math.min(attempt - 1, baseDelays.length - 1);
  const baseDelay = baseDelays[Math.max(0, baseIndex)] ?? 5000;
  const jitter = Math.floor(Math.random() * (jitterMax + 1));

  return baseDelay + jitter;
}

/**
 * Logs structured telemetry for rate-limit and retry lifecycle.
 */
function logRetryEvent(payload: RetryAttemptLog) {
  logger.info(`[AIRetryTelemetry] ${JSON.stringify(payload)}`);
}

/**
 * Executes an AI operation with centralized retry, backoff, and jitter.
 *
 * @param operationFn The async function performing the AI provider call.
 * @param context Metadata about documentId, jobId, operation name.
 * @param callbacks Optional callbacks for lifecycle notifications.
 * @param config Optional custom retry configuration.
 */
export async function executeWithAIRetry<T>(
  operationFn: (attempt: number) => Promise<T>,
  context: RetryContext = {},
  callbacks?: RetryCallbacks,
  config: AIRetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const sleep = callbacks?.sleepFn || defaultSleep;
  const maxAttempts = config.maxAttempts || DEFAULT_RETRY_CONFIG.maxAttempts;
  const providerName = context.providerName || 'gemini';

  let lastNormalizedError: NormalizedAIError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operationFn(attempt);

      if (attempt > 1) {
        logRetryEvent({
          event: 'ai_retry_success',
          documentId: context.documentId,
          jobId: context.jobId,
          operation: context.operation || 'ai_completion',
          attempt,
          maxAttempts,
          message: `Operation succeeded on attempt ${attempt}`,
        });
      }

      return result;
    } catch (error: unknown) {
      const normalized = normalizeAIError(error, providerName);
      lastNormalizedError = normalized;

      // Check if error is retryable
      if (!normalized.retryable) {
        logger.warn(
          `[AIRetry] Non-retryable AI error encountered (Category: ${normalized.category}). Aborting retries immediately.`
        );
        const nonRetryError = error instanceof Error ? error : new Error(String(error));
        (nonRetryError as any).normalizedAIError = normalized;
        throw nonRetryError;
      }

      // Check if max attempts reached
      if (attempt >= maxAttempts) {
        const cooldownMs = normalized.suggestedCooldownMs || config.defaultCooldownMs || DEFAULT_RETRY_CONFIG.defaultCooldownMs;
        const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();

        logRetryEvent({
          event: 'ai_retry_exhausted',
          documentId: context.documentId,
          jobId: context.jobId,
          operation: context.operation || 'ai_completion',
          attempt,
          maxAttempts,
          errorCategory: normalized.category,
          statusCode: normalized.statusCode,
          message: normalized.userMessage,
          cooldownUntil,
        });

        // Enhance error with normalized metadata for downstream handlers
        const finalError = error instanceof Error ? error : new Error(String(error));
        (finalError as any).normalizedAIError = normalized;
        (finalError as any).cooldownUntil = cooldownUntil;
        (finalError as any).cooldownMs = cooldownMs;

        throw finalError;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt + 1, normalized, config);

      logRetryEvent({
        event: 'ai_retry_attempt',
        documentId: context.documentId,
        jobId: context.jobId,
        operation: context.operation || 'ai_completion',
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
        errorCategory: normalized.category,
        statusCode: normalized.statusCode,
        message: normalized.userMessage,
      });

      // Fire retry callback (e.g. to update stage status to 'retrying')
      if (callbacks?.onRetry) {
        try {
          await callbacks.onRetry(attempt, delayMs, normalized, context);
        } catch (cbErr) {
          logger.warn('[AIRetry] onRetry callback error (non-fatal):', cbErr);
        }
      }

      // Wait before next attempt
      await sleep(delayMs);
    }
  }

  throw lastNormalizedError?.originalError || new Error('AI generation attempts exhausted.');
}
