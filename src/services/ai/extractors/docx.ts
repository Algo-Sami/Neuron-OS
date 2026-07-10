import mammoth from 'mammoth';
import { logger } from '@/lib/logger';

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    logger.error('Failed to parse DOCX', error);
    throw new Error('DOCX extraction failed');
  }
}
