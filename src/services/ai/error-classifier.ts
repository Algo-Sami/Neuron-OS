/**
 * Error Classifier for AI Pipeline & Providers
 *
 * Classifies errors into standardized categories and determines retryability.
 * Guarantees that non-retryable errors (e.g. 402 billing, 401 auth, 404 invalid model)
 * are never retried repeatedly, while transient errors (408, 429, 500-504, network timeouts)
 * are handled with exponential backoff.
 */

import { logger } from '@/lib/logger';

export type AIErrorCategory =
  | 'billing'        // 402 Insufficient credits / billing
  | 'auth'           // 401 Unauthorized / invalid key
  | 'forbidden'      // 403 Forbidden / permission denied
  | 'invalid_model'  // 404 Not Found / unsupported model
  | 'bad_request'    // 400 Bad Request / malformed payload / schema mismatch
  | 'rate_limit'     // 429 Too Many Requests / quota exceeded
  | 'timeout'        // 408 Request Timeout / abort signal / ETIMEDOUT
  | 'network'        // Connection refused / reset / unreachable host
  | 'server_error'   // 500, 502, 503, 504 Provider internal server errors
  | 'unknown';

export interface ClassifiedAIError {
  category: AIErrorCategory;
  statusCode?: number;
  retryable: boolean;
  message: string;
  originalError: unknown;
  action: 'stop_provider_attempts' | 'retry_with_backoff' | 'fallback_provider';
}

/**
 * Classifies an arbitrary error thrown by an AI provider or HTTP client.
 */
export function classifyAIError(
  error: unknown,
  providerName: string = 'unknown'
): ClassifiedAIError {
  let message = '';
  let status: number | undefined;

  if (error instanceof Error) {
    message = error.message;
    // Check for custom status property on Error instances
    if ('status' in error && typeof (error as any).status === 'number') {
      status = (error as any).status;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    message = JSON.stringify(error);
    if ('status' in error && typeof (error as any).status === 'number') {
      status = (error as any).status;
    }
  }

  // Extract HTTP status from common error message patterns if not explicitly set
  if (!status) {
    const statusMatch = message.match(/(?:HTTP\s+(?:error\s+)?\[?|status[:\s]+|code[:\s]+)(\d{3})/i) ||
                        message.match(/\[(\d{3})\s+[A-Za-z\s]+\]/);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }
  }

  const lowerMsg = message.toLowerCase();

  let category: AIErrorCategory = 'unknown';
  let retryable = false;
  let action: ClassifiedAIError['action'] = 'stop_provider_attempts';

  // 1. Billing / Credits (402)
  if (
    status === 402 ||
    lowerMsg.includes('insufficient credit') ||
    lowerMsg.includes('requires more credits') ||
    lowerMsg.includes('credit limit') ||
    lowerMsg.includes('billing') ||
    lowerMsg.includes('out of credits') ||
    lowerMsg.includes('can only afford')
  ) {
    category = 'billing';
    status = status || 402;
    retryable = false;
    action = 'stop_provider_attempts';
  }
  // 2. Authentication (401)
  else if (
    status === 401 ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('api_key not valid') ||
    lowerMsg.includes('authentication failed')
  ) {
    category = 'auth';
    status = status || 401;
    retryable = false;
    action = 'stop_provider_attempts';
  }
  // 3. Authorization (403)
  else if (
    status === 403 ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('forbidden') ||
    lowerMsg.includes('access not configured')
  ) {
    category = 'forbidden';
    status = status || 403;
    retryable = false;
    action = 'stop_provider_attempts';
  }
  // 4. Invalid or Unsupported Model (404)
  else if (
    status === 404 ||
    lowerMsg.includes('is not found for api version') ||
    lowerMsg.includes('model not found') ||
    lowerMsg.includes('unsupported model') ||
    lowerMsg.includes('no longer available') ||
    lowerMsg.includes('invalid model') ||
    lowerMsg.includes('unknown model')
  ) {
    category = 'invalid_model';
    status = status || 404;
    retryable = false;
    action = 'stop_provider_attempts';
  }
  // 5. Bad Request / Malformed (400)
  else if (
    status === 400 ||
    lowerMsg.includes('bad request') ||
    lowerMsg.includes('invalid argument') ||
    lowerMsg.includes('malformed')
  ) {
    category = 'bad_request';
    status = status || 400;
    retryable = false;
    action = 'stop_provider_attempts';
  }
  // 6. Rate Limit (429)
  else if (
    status === 429 ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('quota exceeded')
  ) {
    category = 'rate_limit';
    status = status || 429;
    retryable = true;
    action = 'retry_with_backoff';
  }
  // 7. Timeout (408 / Abort / ETIMEDOUT)
  else if (
    status === 408 ||
    lowerMsg.includes('abort') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('etimedout')
  ) {
    category = 'timeout';
    status = status || 408;
    retryable = true;
    action = 'retry_with_backoff';
  }
  // 8. Server Errors (500, 502, 503, 504)
  else if (
    (status && status >= 500 && status <= 504) ||
    lowerMsg.includes('internal server error') ||
    lowerMsg.includes('service unavailable') ||
    lowerMsg.includes('bad gateway') ||
    lowerMsg.includes('gateway timeout')
  ) {
    category = 'server_error';
    status = status || 500;
    retryable = true;
    action = 'retry_with_backoff';
  }
  // 9. Network Connection Errors
  else if (
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error')
  ) {
    category = 'network';
    retryable = true;
    action = 'retry_with_backoff';
  }

  // Log structured classification
  logger.info(
    `[AI Error Classification] provider=${providerName} status=${status || 'none'} category=${category} retryable=${retryable} action=${action}`
  );

  return {
    category,
    statusCode: status,
    retryable,
    message,
    originalError: error,
    action,
  };
}
