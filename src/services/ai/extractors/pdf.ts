import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const pdf = _require('pdf-parse');
import { logger } from '@/lib/logger';
import { getAIClient, getAIModelName } from '../gemini';
import * as fs from 'fs';

function logToDisk(msg: string) {
  try {
    fs.appendFileSync('d:/FYP Project/neuron/background_logs.txt', `[PDF_EXTRACTOR] ${msg}\n`);
  } catch (e) {
    console.error(e);
  }
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  let text = '';
  try {
    // Handle ESM/CJS default exports interop safely
    const parseFn = typeof pdf === 'function' ? pdf : (pdf && pdf.default ? pdf.default : null);
    if (!parseFn) {
      throw new Error('pdf-parse module resolved incorrectly (no function found).');
    }
    const data = await parseFn(buffer);
    text = data.text || '';
    logToDisk(`pdf-parse successfully extracted ${text.length} characters.`);
  } catch (error) {
    const err = error as Error;
    logToDisk(`pdf-parse failed: ${err.message || String(error)}`);
    logger.warn('pdf-parse failed to parse PDF, will attempt Gemini OCR extraction', error);
  }

  // If text is empty or too short (often < 150 chars for typical scanned/empty documents),
  // we try Gemini's multimodal capabilities to extract the text.
  const cleanLength = text.replace(/\s+/g, '').length;
  if (cleanLength < 150) {
    logToDisk(`Extracted PDF text too short (${cleanLength} chars). Falling back to Gemini OCR.`);
    logger.info('Extracted PDF text is empty or too short. Falling back to Gemini OCR/text extraction.');
    try {
      const aiClient = getAIClient();
      const model = aiClient.getGenerativeModel({ model: getAIModelName() });
      
      const prompt = `
        You are an expert OCR and document text extraction tool.
        Your task is to extract all readable text from this PDF document as accurately as possible.
        Maintain the original layout, structure, headings, page numbers, and tables if possible.
        Do not summarize, do not comment, and do not add any conversational text.
        Just output the extracted text content.
      `;
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'application/pdf'
          }
        },
        prompt
      ]);
      
      const geminiText = result.response.text();
      if (geminiText && geminiText.trim().length > 0) {
        logToDisk(`Gemini OCR successfully extracted ${geminiText.length} characters.`);
        logger.info(`Successfully extracted ${geminiText.length} characters of text using Gemini OCR.`);
        return geminiText;
      } else {
        logToDisk(`Gemini OCR returned empty text.`);
      }
    } catch (geminiError) {
      const err = geminiError as Error;
      logToDisk(`Gemini PDF OCR extraction failed: ${err.message || String(geminiError)}`);
      logger.error('Gemini PDF OCR extraction failed', geminiError);
    }
  }

  // If pdf-parse succeeded but was short, or Gemini failed, return the text we got
  return text;
}


