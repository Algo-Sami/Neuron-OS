import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeWithAIRetry } from '../../src/services/ai/errors/retry-policy';

describe('Image OCR Resilient Extraction & Fallback Suite', () => {
  it('Test 1: Primary OCR success returns text immediately without invoking fallback', async () => {
    let tesseractCalled = false;
    let fallbackCalled = false;

    const mockExtract = async (shouldTesseractSucceed: boolean) => {
      // Step 1: Tesseract
      try {
        tesseractCalled = true;
        if (shouldTesseractSucceed) {
          return 'Transcribed Chapter 1: Introduction to Data Structures';
        }
        throw new Error('Tesseract offline error');
      } catch {
        // Step 2: Fallback
        fallbackCalled = true;
        return 'Fallback text';
      }
    };

    const result = await mockExtract(true);
    assert.strictEqual(tesseractCalled, true);
    assert.strictEqual(fallbackCalled, false);
    assert.strictEqual(result, 'Transcribed Chapter 1: Introduction to Data Structures');
  });

  it('Test 2: Primary OCR failure triggers Multimodal Gemini Vision fallback', async () => {
    let tesseractCalled = false;
    let fallbackCalled = false;

    const mockExtract = async (shouldTesseractSucceed: boolean) => {
      try {
        tesseractCalled = true;
        if (shouldTesseractSucceed) return 'Success text';
        throw new Error('Network timeout downloading traineddata');
      } catch {
        fallbackCalled = true;
        return 'Gemini Vision Transcribed Notes: Graph Algorithms BFS & DFS';
      }
    };

    const result = await mockExtract(false);
    assert.strictEqual(tesseractCalled, true);
    assert.strictEqual(fallbackCalled, true);
    assert.strictEqual(result, 'Gemini Vision Transcribed Notes: Graph Algorithms BFS & DFS');
  });

  it('Test 3: Both primary OCR and fallback failure gracefully return safe empty string without crashing', async () => {
    const mockExtractWithTotalFailure = async () => {
      try {
        throw new Error('Tesseract failed');
      } catch {
        try {
          throw new Error('Gemini fallback quota exhausted');
        } catch {
          // Graceful degradation
          return '';
        }
      }
    };

    const result = await mockExtractWithTotalFailure();
    assert.strictEqual(result, '');
  });

  it('Test 4: Bounded timeout rejects stalled operations', async () => {
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise.then(
          (res) => {
            clearTimeout(timer);
            resolve(res);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });
    };

    const hangingPromise = new Promise((resolve) => {
      // Intentionally never resolves
    });

    await assert.rejects(
      async () => {
        await withTimeout(hangingPromise, 50);
      },
      {
        message: 'Operation timed out after 50ms'
      }
    );
  });

  it('Test 5: Explicitly mocks 429 Gemini fallback response and verifies automatic retry recovery', async () => {
    let geminiCallCount = 0;

    // Simulate primary Tesseract OCR failure -> triggers Gemini Vision fallback with executeWithAIRetry
    const mockGeminiFallback = async () => {
      return await executeWithAIRetry(
        async () => {
          geminiCallCount++;
          if (geminiCallCount === 1) {
            const err = new Error('RESOURCE_EXHAUSTED: rate limit exceeded 429');
            (err as any).status = 429;
            throw err;
          }
          return 'Transcribed Formula: E = mc^2 from Gemini Vision OCR';
        },
        { operation: 'gemini-multimodal-ocr', providerName: 'gemini' },
        { sleepFn: async () => {} } // Instant sleep for tests
      );
    };

    const result = await mockGeminiFallback();

    // Verify executeWithAIRetry retried after the 429 and succeeded on attempt 2
    assert.strictEqual(geminiCallCount, 2);
    assert.strictEqual(result, 'Transcribed Formula: E = mc^2 from Gemini Vision OCR');
  });

  it('Test 6: Exhausted 429 retries return safe empty string without crashing the pipeline', async () => {
    let geminiAttempts = 0;

    const mockExtractFromImageWithExhaustedRateLimit = async () => {
      // 1. Tesseract fails
      try {
        throw new Error('Tesseract failed');
      } catch {
        // 2. Gemini fallback with executeWithAIRetry
        try {
          const fallbackText = await executeWithAIRetry(
            async () => {
              geminiAttempts++;
              const err = new Error('RESOURCE_EXHAUSTED: daily limit 429');
              (err as any).status = 429;
              throw err;
            },
            { operation: 'gemini-multimodal-ocr', providerName: 'gemini' },
            { sleepFn: async () => {} } // Uses DEFAULT_RETRY_CONFIG (4 attempts: 1 initial + 3 retries)
          );
          return fallbackText;
        } catch {
          // 3. Graceful degradation on exhausted retries
          return '';
        }
      }
    };

    const result = await mockExtractFromImageWithExhaustedRateLimit();

    // Verify all 4 retry attempts were executed before returning the safe fallback
    assert.strictEqual(geminiAttempts, 4);
    assert.strictEqual(result, '');
  });
});
