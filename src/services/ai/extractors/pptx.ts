import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const officeparser = _require('officeparser');
import { logger } from '@/lib/logger';

export async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    // Safe ESM/CJS interop for officeparser
    const parser = officeparser.parseOffice ? officeparser : (officeparser.default || officeparser);
    if (!parser || typeof parser.parseOffice !== 'function') {
      throw new Error('officeparser module resolved incorrectly (no parseOffice found).');
    }
    
    // officeparser accepts Buffer and returns the extracted text string directly
    const text = await parser.parseOffice(buffer, { fileType: 'pptx' });
    return typeof text === 'string' ? text : (text ? String(text) : '');
  } catch (error) {
    logger.error('Failed to parse PPTX', error);
    throw new Error('PPTX extraction failed');
  }
}
