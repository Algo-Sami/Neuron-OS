import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAIError, extractRetryAfterMs } from '../../src/services/ai/errors/ai-error-normalizer';

describe('AI Error Normalizer Suite', () => {
  it('Test 1: Temporary 429 / RESOURCE_EXHAUSTED is classified as rate_limit_temporary and retryable', () => {
    const err = new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/... [429 Too Many Requests] RESOURCE_EXHAUSTED');
    (err as any).status = 429;

    const normalized = normalizeAIError(err, 'gemini');

    assert.strictEqual(normalized.category, 'rate_limit_temporary');
    assert.strictEqual(normalized.retryable, true);
    assert.strictEqual(normalized.statusCode, 429);
    assert.strictEqual(normalized.providerCode, 'RESOURCE_EXHAUSTED');
    assert.ok(normalized.userMessage.includes('temporarily receiving a high number of AI requests'));
  });

  it('Test 2: Explicit daily quota exhaustion is classified as rate_limit_quota and non-retryable immediately', () => {
    const err = new Error('RESOURCE_EXHAUSTED: Daily request limit reached. Quota metric: generate_requests_per_day');
    (err as any).status = 429;

    const normalized = normalizeAIError(err, 'gemini');

    assert.strictEqual(normalized.category, 'rate_limit_quota');
    assert.strictEqual(normalized.retryable, false);
    assert.strictEqual(normalized.providerCode, 'QUOTA_EXHAUSTED');
    assert.ok(normalized.userMessage.includes('daily usage limits'));
  });

  it('Test 3: Does NOT falsely label standard 429 / RESOURCE_EXHAUSTED as daily quota exhaustion', () => {
    const err = new Error('429 Too Many Requests: Rate limit exceeded. Please try again later.');

    const normalized = normalizeAIError(err, 'openrouter');

    assert.strictEqual(normalized.category, 'rate_limit_temporary');
    assert.strictEqual(normalized.retryable, true);
    assert.notStrictEqual(normalized.category, 'rate_limit_quota');
  });

  it('Test 4: Extracts Retry-After from numeric header and string formats accurately', () => {
    // 30 seconds as number
    const err1 = { status: 429, retryAfter: 30 };
    assert.strictEqual(extractRetryAfterMs(err1), 30000);

    // "45s" string
    const err2 = { status: 429, headers: { 'retry-after': '45s' } };
    assert.strictEqual(extractRetryAfterMs(err2), 45000);

    // Text message pattern
    const err3 = new Error('Rate limit hit, retry after 25 seconds');
    assert.strictEqual(extractRetryAfterMs(err3), 25000);
  });

  it('Test 5: Non-retryable 401 authentication errors fail immediately', () => {
    const err = new Error('API_KEY not valid. Please pass a valid API key.');
    (err as any).status = 401;

    const normalized = normalizeAIError(err, 'gemini');

    assert.strictEqual(normalized.category, 'authentication');
    assert.strictEqual(normalized.retryable, false);
    assert.strictEqual(normalized.statusCode, 401);
  });

  it('Test 6: Non-retryable 400 Bad Request / Schema mismatch errors fail immediately', () => {
    const err = new Error('Invalid argument: prompt is required and cannot be empty.');
    (err as any).status = 400;

    const normalized = normalizeAIError(err, 'gemini');

    assert.strictEqual(normalized.category, 'invalid_request');
    assert.strictEqual(normalized.retryable, false);
    assert.strictEqual(normalized.statusCode, 400);
  });

  it('Test 7: Service Overload (503 / 502) is classified as retryable service_overloaded', () => {
    const err = new Error('The model is overloaded. Please try again later.');
    (err as any).status = 503;

    const normalized = normalizeAIError(err, 'gemini');

    assert.strictEqual(normalized.category, 'service_overloaded');
    assert.strictEqual(normalized.retryable, true);
  });

  it('Test 8: Timeout / ETIMEDOUT errors are classified as retryable timeout', () => {
    const err = new Error('ETIMEDOUT: Connection to AI gateway timed out.');
    (err as any).code = 'ETIMEDOUT';

    const normalized = normalizeAIError(err, 'openrouter');

    assert.strictEqual(normalized.category, 'timeout');
    assert.strictEqual(normalized.retryable, true);
  });

  it('Test 9: Network connection errors (ECONNRESET) are classified as retryable network', () => {
    const err = new Error('fetch failed: ECONNRESET');
    (err as any).code = 'ECONNRESET';

    const normalized = normalizeAIError(err, 'openrouter');

    assert.strictEqual(normalized.category, 'network');
    assert.strictEqual(normalized.retryable, true);
  });
});
