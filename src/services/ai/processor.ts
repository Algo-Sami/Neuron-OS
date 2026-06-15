import { extractTextFromPDF } from './extractors/pdf';
import { extractTextFromDOCX } from './extractors/docx';
import { extractTextFromPPTX } from './extractors/pptx';
import { extractTextFromImage } from './extractors/image';
import { extractTextFromTXT } from './extractors/txt';
import { cleanExtractedText } from './cleaner';
import { logger } from '@/lib/logger';
export async function processDocument(buffer: Buffer, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase();
  let rawText = '';

  logger.info(`Starting extraction for file type: ${ext}`);

  try {
    if (ext === 'pdf') {
      rawText = await extractTextFromPDF(buffer);
    } else if (ext === 'docx' || ext === 'doc') {
      rawText = await extractTextFromDOCX(buffer);
    } else if (ext === 'pptx' || ext === 'ppt') {
      rawText = await extractTextFromPPTX(buffer);
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      rawText = await extractTextFromImage(buffer);
    } else if (ext === 'txt') {
      rawText = await extractTextFromTXT(buffer);
    } else {
      throw new Error(`Unsupported file type for extraction: ${ext}`);
    }

    logger.info(`Extraction complete. Raw length: ${rawText.length}`);
    
    const cleanedText = cleanExtractedText(rawText);
    logger.info(`Cleaning complete. Cleaned length: ${cleanedText.length}`);
    
    return cleanedText;
  } catch (error) {
    logger.error('Document processing pipeline failed', error);
    throw error;
  }
}
