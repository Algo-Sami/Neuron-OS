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
    
    // officeparser v7 returns an AST object with .toText() or directly a string
    const result = await parser.parseOffice(buffer, { fileType: 'pptx' });
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result.toText === 'function') {
      return result.toText();
    }
    if (result && Array.isArray(result.content)) {
      // Fallback extraction from content array if toText is missing
      return JSON.stringify(result.content);
    }
    return result ? String(result) : '';
  } catch (error) {
    logger.error('Failed to parse PPTX', error);
    throw new Error('PPTX extraction failed');
  }
}
