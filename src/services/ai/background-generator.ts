/**
 * Background AI Generator
 *
 * A self-contained, session-independent AI generation service for use in
 * background jobs (fire-and-forget tasks, server workers, etc.)
 *
 * DESIGN PRINCIPLES:
 *  - Uses GEMINI_API_KEY directly — never reads HTTP cookies or session state
 *  - Throws typed errors with full provider details — never silently returns null
 *  - Classifies errors as Retryable or NonRetryable for intelligent retry logic
 *  - Implements exponential backoff: 5s → 10s → 20s
 *  - Validates all AI responses before returning
 *  - Writes structured diagnostic logs to background_logs.txt
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

// ── Logging ───────────────────────────────────────────────────────────────────

function logToDisk(context: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(
      'd:/FYP Project/neuron/background_logs.txt',
      `[${ts}] [BG-AI] [${level}] [${context}] ${message}\n`
    );
  } catch { /* silent — never crash on log failure */ }
}

// ── Typed Error Classification ────────────────────────────────────────────────

export type FailureCategory =
  | 'RATE_LIMITED'          // 429 — wait and retry
  | 'SERVICE_UNAVAILABLE'   // 503 / ECONNRESET — transient, retry
  | 'TIMEOUT'               // Request timed out — retry
  | 'NETWORK_ERROR'         // DNS / connection failure — retry
  | 'INVALID_API_KEY'       // 401 / 403 — do NOT retry
  | 'INVALID_REQUEST'       // 400 bad request — do NOT retry
  | 'SAFETY_BLOCKED'        // SAFETY / RECITATION — do NOT retry
  | 'JSON_PARSE_ERROR'      // Model returned invalid JSON — do NOT retry
  | 'EMPTY_RESPONSE'        // Model returned empty content — do NOT retry
  | 'MODEL_NOT_FOUND'       // Unsupported model — do NOT retry
  | 'QUOTA_EXCEEDED'        // Daily / monthly quota exhausted — do NOT retry
  | 'UNKNOWN';              // Unclassified — retry conservatively

export interface BackgroundGenerationError extends Error {
  category: FailureCategory;
  retryable: boolean;
  providerMessage: string;
  httpStatus?: number;
  attempt: number;
}

function classifyError(err: unknown, attempt: number): BackgroundGenerationError {
  const raw = err as Error;
  const msg = raw?.message || String(err);
  const msgLower = msg.toLowerCase();

  let category: FailureCategory = 'UNKNOWN';
  let retryable = true;

  if (msgLower.includes('429') || msgLower.includes('quota') || msgLower.includes('resource exhausted')) {
    category = 'RATE_LIMITED';
    retryable = true;
  } else if (msgLower.includes('503') || msgLower.includes('service unavailable') || msgLower.includes('high demand')) {
    category = 'SERVICE_UNAVAILABLE';
    retryable = true;
  } else if (msgLower.includes('timeout') || msgLower.includes('etimedout') || msgLower.includes('timed out')) {
    category = 'TIMEOUT';
    retryable = true;
  } else if (msgLower.includes('econnreset') || msgLower.includes('enotfound') || msgLower.includes('network')) {
    category = 'NETWORK_ERROR';
    retryable = true;
  } else if (msgLower.includes('401') || msgLower.includes('403') || msgLower.includes('api key') || msgLower.includes('invalid key')) {
    category = 'INVALID_API_KEY';
    retryable = false;
  } else if (msgLower.includes('400') || msgLower.includes('bad request') || msgLower.includes('invalid request')) {
    category = 'INVALID_REQUEST';
    retryable = false;
  } else if (msgLower.includes('safety') || msgLower.includes('recitation') || msgLower.includes('blocked')) {
    category = 'SAFETY_BLOCKED';
    retryable = false;
  } else if (msgLower.includes('json') || msgLower.includes('unexpected token') || msgLower.includes('parse')) {
    category = 'JSON_PARSE_ERROR';
    retryable = false;
  } else if (msgLower.includes('empty response') || msgLower.includes('no content') || msgLower.includes('returned empty')) {
    category = 'EMPTY_RESPONSE';
    retryable = false;
  } else if (msgLower.includes('model not found') || msgLower.includes('unsupported model') || msgLower.includes('invalid model')) {
    category = 'MODEL_NOT_FOUND';
    retryable = false;
  } else if (msgLower.includes('daily') || msgLower.includes('monthly') || msgLower.includes('exceeded your current quota')) {
    category = 'QUOTA_EXCEEDED';
    retryable = false;
  }

  const classified: BackgroundGenerationError = {
    name:            'BackgroundGenerationError',
    message:         `[${category}] ${msg}`,
    category,
    retryable,
    providerMessage: msg,
    attempt,
    stack:           raw?.stack,
  };

  return classified;
}

// ── Response Validation ───────────────────────────────────────────────────────

function validateJsonResponse(raw: string, context: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw Object.assign(new Error('Gemini returned empty content.'), { isValidationError: true });
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw Object.assign(new Error('Gemini response is whitespace-only.'), { isValidationError: true });
  }

  // Strip markdown fences if the model added them despite instructions
  let cleanJson = trimmed;
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
  }

  if (cleanJson.length < 2) {
    throw Object.assign(
      new Error(`Response too short to be valid JSON (${cleanJson.length} chars).`),
      { isValidationError: true }
    );
  }

  try {
    return JSON.parse(cleanJson);
  } catch (parseErr: any) {
    throw Object.assign(
      new Error(`JSON parse failed for "${context}": ${parseErr.message}. Raw snippet: ${cleanJson.substring(0, 200)}`),
      { isValidationError: true }
    );
  }
}

// ── Exponential Backoff ────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [5000, 10000, 20000]; // 5s, 10s, 20s

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Core: Direct Gemini Call ──────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash';

let _bgAIClient: GoogleGenerativeAI | null = null;

function getBackgroundAIClient(): GoogleGenerativeAI {
  if (!_bgAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('[BG-AI] GEMINI_API_KEY environment variable is not set. Cannot perform AI generation.');
    }
    _bgAIClient = new GoogleGenerativeAI(key);
  }
  return _bgAIClient;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates structured JSON content from a prompt using Gemini directly.
 * - Bypasses routeAIRequest (no cookie session needed)
 * - Throws typed BackgroundGenerationError on failure (never returns null)
 * - Retries only on transient errors with exponential backoff
 * - Validates JSON before returning
 */
export async function generateWithBackoff(
  context:  string,
  prompt:   string,
  maxRetries: number = 3,
): Promise<unknown> {
  let lastError: BackgroundGenerationError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const t0 = Date.now();
    logToDisk(context, `Attempt ${attempt}/${maxRetries} — Querying Gemini (${GEMINI_MODEL})`, 'INFO');

    try {
      const aiClient = getBackgroundAIClient();
      const model = aiClient.getGenerativeModel({ model: GEMINI_MODEL });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0.2,
          maxOutputTokens:  8192,
          responseMimeType: 'application/json',
        },
      });

      const rawText = result.response.text();
      const durationMs = Date.now() - t0;

      logToDisk(context, `Attempt ${attempt} — Response received in ${durationMs}ms (${rawText?.length || 0} chars)`, 'INFO');

      // Validate and parse
      const parsed = validateJsonResponse(rawText, context);
      logToDisk(context, `Attempt ${attempt} — JSON validated successfully`, 'INFO');
      return parsed;

    } catch (err: unknown) {
      const durationMs = Date.now() - t0;
      const classified = classifyError(err, attempt);

      logToDisk(
        context,
        `Attempt ${attempt} FAILED in ${durationMs}ms — Category: ${classified.category} | Retryable: ${classified.retryable} | Message: ${classified.providerMessage}`,
        'WARN'
      );

      lastError = classified;

      // Do NOT retry non-retryable errors
      if (!classified.retryable) {
        logToDisk(context, `Error category "${classified.category}" is not retryable. Aborting.`, 'ERROR');
        throw classified;
      }

      // Apply exponential backoff if we have more attempts
      if (attempt < maxRetries) {
        const delay = BACKOFF_DELAYS_MS[attempt - 1] || 20000;
        logToDisk(context, `Backing off for ${delay / 1000}s before attempt ${attempt + 1}...`, 'INFO');
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  logToDisk(context, `All ${maxRetries} attempts failed. Final error: ${lastError?.message}`, 'ERROR');
  throw lastError || new Error(`[${context}] AI generation failed after ${maxRetries} attempts.`);
}
