import Tesseract from 'tesseract.js';
import { logger } from '@/lib/logger';

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => logger.debug('Tesseract Progress', m.status)
    });
    return result.data.text || '';
  } catch (error) {
    logger.error('Failed to run OCR on image', error);
    throw new Error('Image OCR extraction failed');
  }
}
