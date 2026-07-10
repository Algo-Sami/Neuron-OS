import { getEncoding } from 'js-tiktoken';
import { logger } from '@/lib/logger';

let encodingInstance: any = null;

export function getTokenizer() {
  if (!encodingInstance) {
    try {
      encodingInstance = getEncoding('cl100k_base');
    } catch (err: any) {
      logger.error('[Tokenizer] Failed to load cl100k_base encoding. Falling back to char/4 estimation.', err);
      encodingInstance = {
        encode: (text: string) => {
          const estimatedLength = Math.ceil((text || '').length / 4);
          return { length: estimatedLength };
        }
      };
    }
  }
  return encodingInstance;
}

/**
 * Counts the exact tokens in a text block using the cl100k_base tokenizer.
 * Falls back gracefully to char/4 if the tokenizer fails to load.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return getTokenizer().encode(text).length;
}
