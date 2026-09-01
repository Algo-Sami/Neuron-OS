/**
 * AI Error Normalizer — Phase 1
 * Centralized error parsing, classification, and metadata extraction.
 *
 * Guarantees:
 * 1. Single authoritative classification layer for all AI errors.
 * 2. Provider retry-after metadata priority.
 * 3. Never falsely reports temporary burst limits as daily quota exhaustion.
 * 4. User-facing messages are clear, friendly, and non-technical.
 */

import { AIErrorCategory, NormalizedAIError } from './ai-error-types';
import { logger } from '@/lib/logger';

/**
 * Parses potential Retry-After duration in milliseconds from various formats.
 */
export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error) return undefined;

  let rawHeader: unknown;

  // 1. Inspect direct property or nested headers / details
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, any>;

    rawHeader =
      errObj.retryAfterMs ??
      errObj.retryAfter ??
      errObj.retry_after ??
      errObj.retryDelay ??
      errObj.retry_delay ??
      errObj.retryAfterSeconds ??
      errObj.headers?.['retry-after'] ??
      errObj.headers?.get?.('retry-after') ??
      errObj.response?.headers?.['retry-after'] ??
      errObj.response?.headers?.get?.('retry-after');

    // Check nested GoogleGenerativeAI or OpenRouter error details
    if (!rawHeader && Array.isArray(errObj.errorDetails)) {
      for (const detail of errObj.errorDetails) {
        if (detail?.retryDelay) {
          rawHeader = detail.retryDelay;
          break;
        }
      }
    }
  }

  // 2. Parse value if found
  if (rawHeader !== undefined && rawHeader !== null) {
    if (typeof rawHeader === 'number') {
      // If <= 1000, it's likely in seconds (e.g. 30, 60); if > 1000, likely ms
      return rawHeader < 1000 ? rawHeader * 1000 : rawHeader;
    }
    if (typeof rawHeader === 'string') {
      const matchSeconds = rawHeader.match(/^(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i);
      if (matchSeconds) {
        return Math.round(parseFloat(matchSeconds[1]) * 1000);
      }
      const matchMs = rawHeader.match(/^(\d+)\s*ms$/i);
      if (matchMs) {
        return parseInt(matchMs[1], 10);
      }
      const numericVal = parseFloat(rawHeader);
      if (!isNaN(numericVal)) {
        return numericVal < 1000 ? Math.round(numericVal * 1000) : Math.round(numericVal);
      }
    }
  }

  // 3. Fallback: Parse string message for patterns like "retry after 30s" or "try again in 45 seconds"
  const message = (error instanceof Error ? error.message : typeof error === 'string' ? error : '') || '';
  const regexPatterns = [
    /(?:retry|try again|wait)\s+(?:after|in)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/i,
    /retryDelay[:\s]+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/i,
    /retry-after[:\s]+(\d+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = message.match(regex);
    if (match && match[1]) {
      const parsedSec = parseFloat(match[1]);
      if (!isNaN(parsedSec) && parsedSec > 0) {
        return Math.round(parsedSec * 1000);
      }
    }
  }

  return undefined;
}

/**
 * Normalizes an arbitrary AI error into a structured NormalizedAIError.
 */
export function normalizeAIError(error: unknown, providerName: string = 'ai_provider'): NormalizedAIError {
  let message = '';
  let status: number | undefined;
  let providerCode: string | undefined;
  let rawErrorCode: string | undefined;

  if (error instanceof Error) {
    message = error.message;
    if ('status' in error && typeof (error as any).status === 'number') {
      status = (error as any).status;
    }
    if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
      status = (error as any).statusCode;
    }
    if ('code' in error) {
      rawErrorCode = String((error as any).code);
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, any>;
    message = errObj.message || errObj.error || JSON.stringify(error);
    if (typeof errObj.status === 'number') status = errObj.status;
    if (typeof errObj.statusCode === 'number') status = errObj.statusCode;
    if (errObj.code) rawErrorCode = String(errObj.code);
    if (errObj.error?.code) rawErrorCode = String(errObj.error.code);
  }

  // Extract HTTP status code from message string if not explicitly defined
  if (!status) {
    const statusMatch =
      message.match(/(?:HTTP\s+(?:error\s+)?\[?|status[:\s]+|code[:\s]+)(\d{3})/i) ||
      message.match(/\[(\d{3})\s+[A-Za-z\s]+\]/);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }
  }

  const lowerMsg = message.toLowerCase();
  const retryAfterMs = extractRetryAfterMs(error);

  let category: AIErrorCategory = 'unknown';
  let retryable = false;
  let suggestedCooldownMs: number | undefined;
  let userMessage = 'AI generation encountered an unexpected issue. Please try again.';

  // 1. Explicit Quota Exhaustion (Long-term restriction)
  // Only classify as quota exhaustion when explicitly stated as daily/monthly/free tier limit
  const isExplicitQuotaExhausted =
    lowerMsg.includes('daily quota exceeded') ||
    lowerMsg.includes('daily request limit') ||
    lowerMsg.includes('free tier quota exhausted') ||
    lowerMsg.includes('monthly quota') ||
    lowerMsg.includes('credit limit reached') ||
    lowerMsg.includes('quota metric: generate_requests_per_day') ||
    lowerMsg.includes('exceeded your current quota');

  if (isExplicitQuotaExhausted) {
    category = 'rate_limit_quota';
    status = status || 429;
    providerCode = 'QUOTA_EXHAUSTED';
    retryable = false;
    suggestedCooldownMs = retryAfterMs || 15 * 60 * 1000; // 15 min fallback if not provided
    userMessage =
      'The AI provider has temporarily restricted new generation requests due to daily usage limits. Your uploaded files and existing study resources remain safe.';
  }
  // 2. Temporary Rate Limit / Burst Throttling (429 / RESOURCE_EXHAUSTED / TPM / RPM)
  else if (
    status === 429 ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('rate_limit_exceeded') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('requests per minute') ||
    lowerMsg.includes('tokens per minute') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('quota limit reached') ||
    lowerMsg.includes('try again in') ||
    lowerMsg.includes('retry later')
  ) {
    category = 'rate_limit_temporary';
    status = status || 429;
    providerCode = 'RESOURCE_EXHAUSTED';
    retryable = true;
    // Default temporary cooldown is 60s or provider retry duration
    suggestedCooldownMs = retryAfterMs || 60 * 1000;
    userMessage =
      "We're temporarily receiving a high number of AI requests. We'll automatically retry this generation when possible.";
  }
  // 3. Authentication & Key Errors (401 / 403)
  else if (
    status === 401 ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('api_key not valid') ||
    lowerMsg.includes('authentication failed') ||
    lowerMsg.includes('invalid_api_key')
  ) {
    category = 'authentication';
    status = status || 401;
    providerCode = 'UNAUTHORIZED';
    retryable = false;
    userMessage = 'AI service authentication failed. Please check system credentials.';
  }
  // 4. Invalid Request / Bad Request / Model Not Found (400 / 404)
  else if (
    status === 400 ||
    status === 404 ||
    lowerMsg.includes('invalid argument') ||
    lowerMsg.includes('bad request') ||
    lowerMsg.includes('model not found') ||
    lowerMsg.includes('unsupported model') ||
    lowerMsg.includes('malformed') ||
    lowerMsg.includes('schema mismatch')
  ) {
    category = 'invalid_request';
    status = status || (lowerMsg.includes('model not found') ? 404 : 400);
    providerCode = 'INVALID_REQUEST';
    retryable = false;
    userMessage = 'AI request could not be processed due to invalid parameters.';
  }
  // 5. Service Overloaded / Temporary Unavailable (503 / 502)
  else if (
    status === 503 ||
    status === 502 ||
    lowerMsg.includes('service unavailable') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('server is overloaded') ||
    lowerMsg.includes('temporarily unavailable')
  ) {
    category = 'service_overloaded';
    status = status || 503;
    providerCode = 'SERVICE_OVERLOADED';
    retryable = true;
    suggestedCooldownMs = retryAfterMs || 30 * 1000;
    userMessage = 'The AI service is temporarily overloaded. Retrying shortly...';
  }
  // 6. Timeout (408 / Abort / ETIMEDOUT)
  else if (
    status === 408 ||
    rawErrorCode === 'ETIMEDOUT' ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('deadline exceeded') ||
    lowerMsg.includes('abort')
  ) {
    category = 'timeout';
    status = status || 408;
    providerCode = 'TIMEOUT';
    retryable = true;
    suggestedCooldownMs = 15 * 1000;
    userMessage = 'The AI service timed out while processing your request. Retrying...';
  }
  // 7. Network Failures (Connection refused / reset / unreachable)
  else if (
    rawErrorCode === 'ECONNRESET' ||
    rawErrorCode === 'ECONNREFUSED' ||
    rawErrorCode === 'ENOTFOUND' ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('econnrefused')
  ) {
    category = 'network';
    providerCode = 'NETWORK_ERROR';
    retryable = true;
    suggestedCooldownMs = 10 * 1000;
    userMessage = 'Network connection to the AI provider failed temporarily. Retrying...';
  }
  // 8. General Server Error (500 / 504)
  else if (status && status >= 500 && status <= 504) {
    category = 'provider_error';
    providerCode = 'SERVER_ERROR';
    retryable = true;
    suggestedCooldownMs = 20 * 1000;
    userMessage = 'AI provider internal error. Retrying...';
  }

  logger.info(
    `[AI Error Normalizer] provider=${providerName} status=${status || 'none'} category=${category} retryable=${retryable} retryAfterMs=${retryAfterMs || 'none'}`
  );

  return {
    category,
    statusCode: status,
    providerCode,
    retryable,
    retryAfterMs,
    suggestedCooldownMs,
    userMessage,
    technicalMessage: message.slice(0, 500),
    rawErrorCode,
    originalError: error,
  };
}
