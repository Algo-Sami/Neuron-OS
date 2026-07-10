import { SupabaseClient } from '@supabase/supabase-js';
import {
  generateSummaryPDF,
  generateKeyConceptsPDF,
  generateDefinitionsPDF,
  generateFlashcardsPDF,
  generateMCQsPDF,
  generatePracticeQuestionsPDF,
  generateStudyGuidePDF,
} from '@/services/pdf/study-pack-pdf';
import { logger } from '@/lib/logger';

export interface GeneratedPdfResult {
  key: string;
  displayName: string;
  suffixName: string;
  storagePath: string;
  publicUrl: string;
  size: number;
  customFileName?: string;
}

export class PDFGeneratorService {
  constructor(private supabase: SupabaseClient) {}

  async run(
    documentId: string,
    userId: string,
    docTitle: string,
    subjectName: string
  ): Promise<GeneratedPdfResult[]> {
    logger.info(`[PDFGeneratorService] Generating PDFs from structured content for document: ${documentId}`);

    const baseTitle = docTitle.replace(/\.[^/.]+$/, '');
    const baseDir = `${userId}/ai-gen-${documentId}`;

    const jobs = [
      {
        key: 'summary',
        displayName: 'Summary',
        suffixName: 'Summary',
        fileName: 'summary.json',
        generator: generateSummaryPDF
      },
      {
        key: 'keyConcepts',
        displayName: 'Key Concepts',
        suffixName: 'Key Concepts',
        fileName: 'key-concepts.json',
        generator: generateKeyConceptsPDF
      },
      {
        key: 'definitions',
        displayName: 'Definitions',
        suffixName: 'Definitions',
        fileName: 'definitions.json',
        generator: generateDefinitionsPDF
      },
      {
        key: 'flashcards',
        displayName: 'Flashcards',
        suffixName: 'Flashcards',
        fileName: 'flashcards.json',
        generator: generateFlashcardsPDF
      },
      {
        key: 'mcqs',
        displayName: 'MCQ Practice',
        suffixName: 'MCQ Practice',
        fileName: 'mcqs.json',
        generator: generateMCQsPDF
      },
      {
        key: 'practiceQuestions',
        displayName: 'Practice Questions',
        suffixName: 'Practice Questions',
        fileName: 'practice-questions.json',
        generator: generatePracticeQuestionsPDF
      },
      {
        key: 'studyGuide',
        displayName: 'Study Guide',
        suffixName: 'Study Guide',
        fileName: 'study-guide.json',
        generator: generateStudyGuidePDF
      }
    ];

    const results: GeneratedPdfResult[] = [];

    for (const job of jobs) {
      const jsonPath = `${baseDir}/${job.fileName}`;
      try {
        // 1. Download structured JSON
        const { data: fileData, error: dlErr } = await this.supabase.storage
          .from('documents')
          .download(jsonPath);

        if (dlErr || !fileData) {
          logger.warn(`[PDFGeneratorService] Skipped ${job.displayName} — structured JSON not found in storage.`);
          continue;
        }

        const jsonText = await fileData.text();
        const content = JSON.parse(jsonText);

        // 2. Generate PDF Buffer
        logger.info(`[PDFGeneratorService] Compiling PDF for: ${job.displayName}`);
        const pdfBuffer = await job.generator(content, baseTitle, subjectName);

        // 3. Upload compiled PDF to storage
        const ts = Date.now();
        const cleanSuffix = job.suffixName.replace(/\s+/g, '-').toLowerCase();
        const pdfStoragePath = `${userId}/ai-gen-${ts}-${documentId.substring(0, 8)}-${cleanSuffix}.pdf`;

        const { error: upErr } = await this.supabase.storage
          .from('documents')
          .upload(pdfStoragePath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true
          });

        if (upErr) {
          logger.error(`[PDFGeneratorService] Upload failed for PDF ${job.displayName}: ${upErr.message}`);
          continue;
        }

        const { data: { publicUrl } } = this.supabase.storage
          .from('documents')
          .getPublicUrl(pdfStoragePath);

        results.push({
          key: job.key,
          displayName: job.displayName,
          suffixName: job.suffixName,
          storagePath: pdfStoragePath,
          publicUrl,
          size: pdfBuffer.length
        });

        logger.info(`[PDFGeneratorService] Successfully generated & saved PDF: ${job.displayName}`);
      } catch (err: any) {
        logger.error(`[PDFGeneratorService] Error compiling/uploading PDF for ${job.displayName}: ${err.message}`);
      }
    }

    return results;
  }
}
