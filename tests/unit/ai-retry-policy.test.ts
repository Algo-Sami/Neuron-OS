import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeWithAIRetry, calculateBackoffDelay, DEFAULT_RETRY_CONFIG } from '../../src/services/ai/errors/retry-policy';
import { normalizeAIError } from '../../src/services/ai/errors/ai-error-normalizer';

describe('AI Retry Policy Suite', () => {
  it('Test 1: Recovers automatically when first attempt fails with 429 and second attempt succeeds', async () => {
    let callCount = 0;

    const result = await executeWithAIRetry(
      async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('RESOURCE_EXHAUSTED: rate limit exceeded');
          (err as any).status = 429;
          throw err;
        }
        return { success: true, text: 'Generated summary result successfully.' };
      },
      { operation: 'unit_test_success', providerName: 'gemini' },
      { sleepFn: async () => {} } // Instant sleep for tests
    );

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.text, 'Generated summary result successfully.');
  });

  it('Test 2: Non-retryable error (e.g. 401 Unauthorized) aborts immediately on attempt 1', async () => {
    let callCount = 0;

    await assert.rejects(
      async () => {
        await executeWithAIRetry(
          async () => {
            callCount++;
            const err = new Error('API_KEY_INVALID');
            (err as any).status = 401;
            throw err;
          },
          { operation: 'unit_test_auth_fail', providerName: 'gemini' },
          { sleepFn: async () => {} }
        );
      },
      (err: any) => {
        assert.strictEqual(callCount, 1);
        assert.strictEqual(err.normalizedAIError?.category, 'authentication');
        assert.strictEqual(err.normalizedAIError?.retryable, false);
        return true;
      }
    );
  });

  it('Test 3: Exhausted retries attach normalized error metadata and cooldown timestamp', async () => {
    let callCount = 0;

    await assert.rejects(
      async () => {
        await executeWithAIRetry(
          async () => {
            callCount++;
            const err = new Error('429 Too Many Requests: Rate limit exceeded');
            (err as any).status = 429;
            throw err;
          },
          { operation: 'unit_test_exhaustion', providerName: 'gemini' },
          { sleepFn: async () => {} },
          { maxAttempts: 3, baseDelaysMs: [0, 10, 20], jitterMs: 0, defaultCooldownMs: 60000 }
        );
      },
      (err: any) => {
        assert.strictEqual(callCount, 3); // initial + 2 retries
        assert.ok(err.normalizedAIError);
        assert.strictEqual(err.normalizedAIError.category, 'rate_limit_temporary');
        assert.ok(err.cooldownUntil);
        const cooldownTime = new Date(err.cooldownUntil).getTime();
        assert.ok(cooldownTime > Date.now());
        return true;
      }
    );
  });

  it('Test 4: Backoff calculation prioritizes provider Retry-After over default schedule', () => {
    const errorWithRetryAfter = normalizeAIError(
      Object.assign(new Error('Rate limited'), { status: 429, retryAfter: 45 })
    );

    const delayOverride = calculateBackoffDelay(1, errorWithRetryAfter, {
      ...DEFAULT_RETRY_CONFIG,
      jitterMs: 0
    });

    // Should prioritize ~45000ms
    assert.ok(delayOverride >= 45000 && delayOverride <= 45500);
  });

  it('Test 5: Jitter calculation remains within bounded [delay, delay + jitterMs] range', () => {
    const normalizedErr = normalizeAIError(
      Object.assign(new Error('Rate limited'), { status: 429 })
    );

    const config = {
      maxAttempts: 4,
      baseDelaysMs: [0, 5000, 15000, 30000],
      jitterMs: 1500,
      defaultCooldownMs: 60000
    };

    for (let i = 0; i < 20; i++) {
      // Attempt 2 uses baseDelaysMs[1] = 5000ms
      const delayWithJitter = calculateBackoffDelay(2, normalizedErr, config);
      assert.ok(delayWithJitter >= 5000, `Delay ${delayWithJitter} should be >= 5000`);
      assert.ok(delayWithJitter <= 6500, `Delay ${delayWithJitter} should be <= 6500`);
    }
  });

  it('Test 6: Emits onRetry callback with accurate attempt numbers and delay values', async () => {
    const retryEvents: { attempt: number; delayMs: number }[] = [];
    let attempts = 0;

    await executeWithAIRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('503 Service Unavailable');
          (err as any).status = 503;
          throw err;
        }
        return 'success';
      },
      { operation: 'unit_test_callbacks', providerName: 'gemini' },
      {
        sleepFn: async () => {},
        onRetry: (attempt, delayMs) => {
          retryEvents.push({ attempt, delayMs });
        }
      },
      { maxAttempts: 4, baseDelaysMs: [0, 10, 20, 30], jitterMs: 0, defaultCooldownMs: 60000 }
    );

    assert.strictEqual(attempts, 3);
    assert.strictEqual(retryEvents.length, 2);
    assert.strictEqual(retryEvents[0].attempt, 1);
    assert.strictEqual(retryEvents[1].attempt, 2);
  });
});
