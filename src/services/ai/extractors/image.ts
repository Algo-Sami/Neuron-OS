import Tesseract from 'tesseract.js';
import { logger } from '@/lib/logger';
import { getAIClient, getAIModelName } from '../gemini';
import { executeWithAIRetry } from '../errors/retry-policy';

/**
 * Timeout configuration for Tesseract OCR to prevent unbounded hangs in restricted container environments.
 */
const OCR_TIMEOUT_MS = 25000;

/**
 * Executes a promise with an enforced timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Fallback OCR using Gemini Multimodal Vision if Tesseract fails or times out.
 * Integrates directly with Neuron OS's centralized retry policy and rate-limit recovery.
 */
async function extractTextWithGeminiVision(buffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  const result = await executeWithAIRetry(
    async () => {
      const aiClient = getAIClient();
      const model = aiClient.getGenerativeModel({ model: getAIModelName() });

      const prompt = `
        You are an expert OCR transcription assistant for academic materials.
        Transcribe all readable text, formulas, diagram descriptions, and notes from this image.
        Output ONLY the extracted text directly in clean markdown format. Do not add conversational chatter, intros, or markdown wraps.
      `;

      const response = await model.generateContent([
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: mimeType
          }
        },
        prompt
      ]);

      return response.response.text() || '';
    },
    {
      operation: 'gemini-multimodal-ocr'
    }
  );

  return result || '';
}

/**
 * Extracts text from an image buffer with primary Tesseract OCR and automatic Gemini Vision fallback.
 */
export async function extractTextFromImage(buffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  // 1. Primary OCR attempt via Tesseract with bounded timeout
  try {
    const ocrPromise = Tesseract.recognize(buffer, 'eng', {
      logger: (m) => logger.debug('Tesseract Progress', m.status)
    });

    const result = await withTimeout(ocrPromise, OCR_TIMEOUT_MS, 'Tesseract OCR');
    const text = result?.data?.text || '';
    if (text.trim().length > 0) {
      return text;
    }
    logger.warn('[extractTextFromImage] Tesseract returned empty text. Triggering fallback...');
  } catch (ocrError: any) {
    logger.warn(`[extractTextFromImage] Primary Tesseract OCR failed (${ocrError?.message || ocrError}). Attempting fallback...`);
  }

  // 2. Multimodal AI / Gemini Vision Fallback using Centralized Retry Architecture
  try {
    logger.info('[extractTextFromImage] Attempting Gemini Multimodal OCR fallback...');
    const fallbackText = await extractTextWithGeminiVision(buffer, mimeType);
    if (fallbackText && fallbackText.trim().length > 0) {
      logger.info('[extractTextFromImage] Gemini Multimodal OCR fallback succeeded.');
      return fallbackText;
    }
  } catch (fallbackError: any) {
    logger.error('[extractTextFromImage] Fallback Gemini Vision OCR failed:', fallbackError?.message || fallbackError);
  }

  // 3. Graceful degradation: return empty string rather than crashing the background worker
  return '';
}
