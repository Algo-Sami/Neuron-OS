/**
 * IngestionVerificationService — Phase 1.1
 *
 * Runs 9 objective checks after chunk generation to confirm a document
 * has been fully and correctly ingested before marking it Completed.
 *
 * Checks:
 *   1. Original PDF exists in storage (non-zero file size)
 *   2. Document record is valid (user, subject, title, timestamp)
 *   3. Text was extracted (non-empty, exceeds minimum length)
 *   4. Extracted text is readable (quality ratios, no OCR garbage)
 *   5. Chunks exist (at least one row in document_chunks)
 *   6. Chunk indexes are valid (start at 0, continuous, no gaps or duplicates)
 *   7. Chunk content is readable (no empty or duplicate chunks)
 *   8. Processing statistics are computable (chars, words, chunks, avg size)
 *   9. Background task is still alive and not cancelled
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CheckResult {
  passed: boolean;
  reason?: string;
}

export interface VerificationStats {
  totalChars:      number;
  totalWords:      number;
  totalChunks:     number;
  avgChunkSizeChars: number;
  processingTimeMs: number;
}

export interface VerificationReport {
  passed:       boolean;
  failedCheck:  string | null;
  failedReason: string | null;
  stats:        VerificationStats;
  checkResults: Record<string, CheckResult>;
  verifiedAt:   string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class IngestionVerificationService {
  constructor(
    private supabase:   SupabaseClient,
    private documentId: string,
    private userId:     string,
    private taskId:     string,
    private fileUrl:    string,
    private pipelineStartMs: number
  ) {}

  // ── Check 1: Original PDF Exists in Storage ──────────────────────────────

  private async checkPdfExists(): Promise<CheckResult> {
    try {
      const pathParts  = this.fileUrl.split('/');
      const fileName   = pathParts[pathParts.length - 1];
      const storagePath = `${this.userId}/${fileName}`;

      const { data: fileData, error } = await this.supabase.storage
        .from('documents')
        .download(storagePath);

      if (error || !fileData) {
        return { passed: false, reason: `Original file not found in storage at path: ${storagePath}. Error: ${error?.message || 'No data returned'}` };
      }

      const fileSize = fileData.size;
      if (fileSize === 0) {
        return { passed: false, reason: `Original file exists in storage but is 0 bytes (empty file). Path: ${storagePath}` };
      }

      return { passed: true };
    } catch (err: any) {
      return { passed: false, reason: `Exception while checking PDF existence: ${err?.message || String(err)}` };
    }
  }

  // ── Check 2: Document Record is Valid ───────────────────────────────────

  private async checkDocumentRecord(): Promise<CheckResult> {
    try {
      const { data: doc, error } = await this.supabase
        .from('documents')
        .select('id, user_id, subject_id, title, created_at, file_url')
        .eq('id', this.documentId)
        .single();

      if (error || !doc) {
        return { passed: false, reason: `Document record not found in database. Error: ${error?.message || 'Not found'}` };
      }

      if (doc.user_id !== this.userId) {
        return { passed: false, reason: `Document record user_id mismatch. Expected: ${this.userId}, found: ${doc.user_id}` };
      }

      if (!doc.subject_id) {
        return { passed: false, reason: 'Document record has no subject_id — classification may have failed.' };
      }

      if (!doc.title || doc.title.trim().length === 0) {
        return { passed: false, reason: 'Document record has an empty title.' };
      }

      if (!doc.created_at) {
        return { passed: false, reason: 'Document record is missing upload timestamp (created_at).' };
      }

      return { passed: true };
    } catch (err: any) {
      return { passed: false, reason: `Exception while checking document record: ${err?.message || String(err)}` };
    }
  }

  // ── Check 3: Text Was Extracted ──────────────────────────────────────────

  private async checkTextExtracted(): Promise<{ result: CheckResult; cleanedText: string | null }> {
    try {
      const { data: knowledge, error } = await this.supabase
        .from('document_knowledge')
        .select('cleaned_text, extraction_status, validation_status')
        .eq('document_id', this.documentId)
        .single();

      if (error || !knowledge) {
        return {
          result: { passed: false, reason: `document_knowledge record not found. Error: ${error?.message || 'Not found'}` },
          cleanedText: null
        };
      }

      if (knowledge.extraction_status !== 'success') {
        return {
          result: { passed: false, reason: `Extraction did not succeed. Status: ${knowledge.extraction_status}` },
          cleanedText: null
        };
      }

      if (!knowledge.cleaned_text || knowledge.cleaned_text.trim().length === 0) {
        return {
          result: { passed: false, reason: 'Text extraction returned an empty result. Processing stopped before chunk generation.' },
          cleanedText: null
        };
      }

      const MIN_CHARS = 200;
      if (knowledge.cleaned_text.length < MIN_CHARS) {
        return {
          result: { passed: false, reason: `Extracted text is too short: ${knowledge.cleaned_text.length} characters (minimum ${MIN_CHARS}).` },
          cleanedText: null
        };
      }

      return { result: { passed: true }, cleanedText: knowledge.cleaned_text };
    } catch (err: any) {
      return {
        result: { passed: false, reason: `Exception while checking text extraction: ${err?.message || String(err)}` },
        cleanedText: null
      };
    }
  }

  // ── Check 4: Text Quality ────────────────────────────────────────────────

  private checkTextQuality(cleanedText: string): CheckResult {
    if (!cleanedText) {
      return { passed: false, reason: 'Cannot check text quality — cleaned text is null.' };
    }

    const trimmed = cleanedText.trim();

    // Not entirely whitespace
    if (trimmed.replace(/\s+/g, '').length === 0) {
      return { passed: false, reason: 'Extracted text contains only whitespace — extraction produced no readable content.' };
    }

    // Alphanumeric ratio (catches symbol dumps, binary noise)
    const alphanumericCount = trimmed.replace(/[^a-zA-Z0-9]/g, '').length;
    const ratio = alphanumericCount / trimmed.length;
    if (ratio < 0.20) {
      return { passed: false, reason: `Text quality too low: only ${(ratio * 100).toFixed(1)}% alphanumeric characters (minimum 20%). Likely corrupted or unreadable extraction.` };
    }

    // Minimum alphabetic characters (catches number-only, formula-only extractions)
    const alphaCount = trimmed.replace(/[^a-zA-Z]/g, '').length;
    if (alphaCount < 100) {
      return { passed: false, reason: `Text contains insufficient alphabetic content: ${alphaCount} characters (minimum 100). Extraction may be incomplete or broken.` };
    }

    // Repeated character check (catches OCR garbage: "xxxxxxxx", "........")
    if (/(.)(\1{30,})/.test(trimmed)) {
      return { passed: false, reason: 'Text contains long runs of a single repeated character — likely OCR garbage or a broken extraction.' };
    }

    return { passed: true };
  }

  // ── Check 5: Chunks Exist ────────────────────────────────────────────────

  private async checkChunksExist(): Promise<{ result: CheckResult; chunks: any[] }> {
    try {
      const { data: chunks, error } = await this.supabase
        .from('document_chunks')
        .select('id, chunk_index, content, document_id')
        .eq('document_id', this.documentId)
        .order('chunk_index', { ascending: true });

      if (error) {
        return {
          result: { passed: false, reason: `Failed to query document_chunks: ${error.message}` },
          chunks: []
        };
      }

      if (!chunks || chunks.length === 0) {
        return {
          result: { passed: false, reason: 'Chunk verification failed: No chunks were stored for this document.' },
          chunks: []
        };
      }

      return { result: { passed: true }, chunks };
    } catch (err: any) {
      return {
        result: { passed: false, reason: `Exception while checking chunks: ${err?.message || String(err)}` },
        chunks: []
      };
    }
  }

  // ── Check 6: Chunk Indexes are Valid ────────────────────────────────────

  private checkChunkIndexes(chunks: any[]): CheckResult {
    if (!chunks || chunks.length === 0) {
      return { passed: false, reason: 'Cannot check chunk indexes — no chunks provided.' };
    }

    // Must start at 0
    const first = chunks[0].chunk_index;
    if (first !== 0) {
      return { passed: false, reason: `Chunk indexes must start at 0 but first chunk has index ${first}.` };
    }

    // Must be continuous (no gaps, no duplicates)
    const seen = new Set<number>();
    for (let i = 0; i < chunks.length; i++) {
      const idx = chunks[i].chunk_index;

      if (seen.has(idx)) {
        return { passed: false, reason: `Chunk index ${idx} appears more than once — duplicate chunk indexes detected.` };
      }
      seen.add(idx);

      if (idx !== i) {
        return { passed: false, reason: `Chunk index sequence has a gap: expected ${i} but found ${idx} at position ${i}.` };
      }

      // Every chunk must belong to correct document
      if (chunks[i].document_id !== this.documentId) {
        return { passed: false, reason: `Chunk at index ${idx} has wrong document_id: ${chunks[i].document_id}. Expected: ${this.documentId}.` };
      }
    }

    return { passed: true };
  }

  // ── Check 7: Chunk Content ───────────────────────────────────────────────

  private checkChunkContent(chunks: any[]): CheckResult {
    const seenContent = new Set<string>();

    for (const chunk of chunks) {
      const content: string = chunk.content || '';

      // Must not be empty
      if (!content || content.trim().length === 0) {
        return { passed: false, reason: `Chunk at index ${chunk.chunk_index} is empty. No empty chunks are allowed.` };
      }

      // Must not be a duplicate of another chunk
      const normalized = content.trim();
      if (seenContent.has(normalized)) {
        return { passed: false, reason: `Chunk at index ${chunk.chunk_index} is a duplicate of an earlier chunk. Duplicate content is not allowed.` };
      }
      seenContent.add(normalized);
    }

    return { passed: true };
  }

  // ── Check 8: Processing Statistics ──────────────────────────────────────

  private computeStats(cleanedText: string | null, chunks: any[]): VerificationStats {
    const totalChars  = cleanedText ? cleanedText.length : 0;
    const totalWords  = cleanedText ? cleanedText.trim().split(/\s+/).filter(Boolean).length : 0;
    const totalChunks = chunks.length;
    const avgChunkSizeChars = totalChunks > 0
      ? Math.round(chunks.reduce((sum, c) => sum + (c.content?.length || 0), 0) / totalChunks)
      : 0;
    const processingTimeMs = Date.now() - this.pipelineStartMs;

    return { totalChars, totalWords, totalChunks, avgChunkSizeChars, processingTimeMs };
  }

  // ── Check 9: Background Task is Alive ───────────────────────────────────

  private async checkTaskAlive(): Promise<CheckResult> {
    try {
      const { data: task, error } = await this.supabase
        .from('background_tasks')
        .select('id, status')
        .eq('id', this.taskId)
        .maybeSingle();

      if (error) {
        return { passed: false, reason: `Failed to query background task: ${error.message}` };
      }

      if (!task) {
        return { passed: false, reason: `Background task record not found (id: ${this.taskId}). It may have been deleted during account deletion.` };
      }

      const cancelledStatuses = ['cancelled', 'Cancelled'];
      if (cancelledStatuses.includes(task.status)) {
        return { passed: false, reason: `Background task was cancelled mid-processing. Current status: ${task.status}` };
      }

      return { passed: true };
    } catch (err: any) {
      return { passed: false, reason: `Exception while checking background task: ${err?.message || String(err)}` };
    }
  }

  // ── Main Verification Runner ─────────────────────────────────────────────

  async verify(): Promise<VerificationReport> {
    const checkResults: Record<string, CheckResult> = {};
    let failedCheck:  string | null = null;
    let failedReason: string | null = null;
    let cleanedText:  string | null = null;
    let chunks:       any[]         = [];

    // Check 1: PDF exists
    checkResults['1_pdf_exists'] = await this.checkPdfExists();

    // Check 2: Document record
    checkResults['2_document_record'] = await this.checkDocumentRecord();

    // Check 3: Text extracted (returns cleaned text for subsequent checks)
    const extractionResult = await this.checkTextExtracted();
    checkResults['3_text_extracted'] = extractionResult.result;
    cleanedText = extractionResult.cleanedText;

    // Check 4: Text quality (only if we have text)
    checkResults['4_text_quality'] = cleanedText
      ? this.checkTextQuality(cleanedText)
      : { passed: false, reason: 'Cannot assess text quality — text extraction failed in Check 3.' };

    // Check 5: Chunks exist (returns chunks array for subsequent checks)
    const chunksResult = await this.checkChunksExist();
    checkResults['5_chunks_exist'] = chunksResult.result;
    chunks = chunksResult.chunks;

    // Check 6: Chunk indexes (only if chunks exist)
    checkResults['6_chunk_indexes'] = chunks.length > 0
      ? this.checkChunkIndexes(chunks)
      : { passed: false, reason: 'Cannot verify chunk indexes — no chunks found in Check 5.' };

    // Check 7: Chunk content (only if chunks exist)
    checkResults['7_chunk_content'] = chunks.length > 0
      ? this.checkChunkContent(chunks)
      : { passed: false, reason: 'Cannot verify chunk content — no chunks found in Check 5.' };

    // Check 8: Processing statistics (always computable, never fails)
    const stats = this.computeStats(cleanedText, chunks);
    checkResults['8_statistics'] = { passed: true }; // Stats are informational, never block

    // Check 9: Background task alive
    checkResults['9_task_alive'] = await this.checkTaskAlive();

    // Determine overall pass/fail (checks 1-7 and 9 are blocking; 8 is informational)
    const blockingChecks = [
      '1_pdf_exists',
      '2_document_record',
      '3_text_extracted',
      '4_text_quality',
      '5_chunks_exist',
      '6_chunk_indexes',
      '7_chunk_content',
      '9_task_alive',
    ];

    for (const key of blockingChecks) {
      if (!checkResults[key].passed) {
        failedCheck  = key;
        failedReason = checkResults[key].reason || 'Unknown failure reason.';
        break;
      }
    }

    return {
      passed:       failedCheck === null,
      failedCheck,
      failedReason,
      stats,
      checkResults,
      verifiedAt: new Date().toISOString(),
    };
  }
}
