/**
 * AI Error Types & Normalized Model — Phase 1 & 2
 * Centralized typing for all AI error classifications, retry policies,
 * and rate-limit recovery mechanisms.
 */

export type AIErrorCategory =
  | 'rate_limit_temporary' // HTTP 429, RESOURCE_EXHAUSTED, RPM/TPM throttling (retryable)
  | 'rate_limit_quota'     // Explicit daily/monthly quota exhaustion (non-retryable immediately)
  | 'service_overloaded'   // HTTP 503 / 502 / server overload (retryable)
  | 'timeout'              // HTTP 408 / ETIMEDOUT / deadline exceeded (retryable)
  | 'network'              // Connection reset / connection refused / DNS lookup failed (retryable)
  | 'authentication'       // HTTP 401 / invalid API key / unauthorized (non-retryable)
  | 'invalid_request'      // HTTP 400 / 404 / malformed schema / unsupported model (non-retryable)
  | 'provider_error'       // HTTP 500 internal provider fault (retryable)
  | 'unknown';             // Fallback unclassified error

export interface NormalizedAIError {
  category: AIErrorCategory;
  statusCode?: number;
  providerCode?: string;
  retryable: boolean;
  retryAfterMs?: number;
  suggestedCooldownMs?: number;
  userMessage: string;
  technicalMessage?: string;
  rawErrorCode?: string;
  originalError?: unknown;
}

export interface AIRetryConfig {
  maxAttempts: number;       // e.g. 4 (1 initial + 3 retries)
  baseDelaysMs: number[];    // e.g. [0, 5000, 15000, 30000]
  jitterMs: number;          // e.g. 1500 (random 0-1500ms added)
  defaultCooldownMs: number; // e.g. 60000 (1 minute default cooldown on exhausted retry)
}

export interface RetryAttemptLog {
  event: 'ai_retry_attempt' | 'ai_retry_success' | 'ai_retry_exhausted' | 'ai_rate_limit_detected' | 'ai_cooldown_started' | 'ai_manual_retry';
  documentId?: string;
  jobId?: string;
  operation?: string;
  attempt?: number;
  maxAttempts?: number;
  delayMs?: number;
  errorCategory?: AIErrorCategory;
  statusCode?: number;
  message?: string;
  cooldownUntil?: string;
}
