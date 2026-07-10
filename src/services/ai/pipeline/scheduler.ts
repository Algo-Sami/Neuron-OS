import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProgress, StageProgress } from './types';
import { DocumentExtractionService } from './extraction-service';
import { IngestionVerificationService } from './ingestion-verification-service';
import { EmbeddingService } from './embedding-service';
import { EmbeddingVerificationService } from './embedding-verification-service';
import { UserPreferences } from '@/lib/preferences';
import { logger } from '@/lib/logger';
import { chunkText } from '../chunker';
import * as fs from 'fs';
import { SummarySkillService } from './summary-skill-service';
import { generateSummaryPDF } from '@/services/pdf/study-pack-pdf';
import { FolderSyncService } from './folder-sync-service';
import { GeneratedPdfResult } from './pdf-generator-service';
import { PipelineValidator } from './context-validator';

export interface SchedulerOptions {
  forceRun?: boolean;
  preferences?: UserPreferences;
  destinationFolderId?: string;
}




export class AIJobScheduler {
  private progressState!: TaskProgress;
  private logEntries: any[] = [];

  constructor(
    private supabase: SupabaseClient,
    private documentId: string,
    private userId: string,
    private taskId: string,
    private options: SchedulerOptions = {}
  ) {
    this.initProgressState();
  }

  private initProgressState() {
    this.progressState = {
      overallStatus: 'processing',
      stages: {
        extraction:      { status: 'pending' },
        chunking:        { status: 'pending' },
        verification:    { status: 'pending' },
        embedding:       { status: 'pending' },
        knowledgeVerify: { status: 'pending' },
        summaryGen:      { status: 'pending' },
        pdfRender:       { status: 'pending' },
      }
    };
  }

  private logDisk(stage: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const ts = new Date().toISOString();
    const formatted = `[${ts}] [Scheduler] [${this.documentId.substring(0, 8)}] [${stage}] (${level}) ${message}\n`;
    try {
      fs.appendFileSync('d:/FYP Project/neuron/background_logs.txt', formatted);
    } catch { /* ignore */ }
    logger.info(`[Scheduler][${stage}][${level}] ${message}`);

    this.logEntries.push({
      timestamp: ts,
      stage,
      message,
      level
    });
  }

  private async saveProgress(status: string, errorMessage?: string) {
    const now = new Date().toISOString();

    // Check if task is cancelled or deleted (e.g. during account deletion)
    const { data: taskCheck, error: checkError } = await this.supabase
      .from('background_tasks')
      .select('status')
      .eq('id', this.taskId)
      .maybeSingle();

    if (checkError) {
      this.logDisk('progress', `Failed to check task status: ${checkError.message}`, 'WARN');
    }

    if (!taskCheck || taskCheck.status === 'Cancelled' || taskCheck.status === 'cancelled') {
      this.logDisk('progress', 'Task cancelled or deleted. Aborting background processing.', 'WARN');
      throw new Error('TASK_CANCELLED');
    }

    let overallStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'processing';
    if (status === 'Completed') overallStatus = 'completed';
    else if (status === 'Failed') overallStatus = 'failed';
    else if (status === 'Queued') overallStatus = 'pending';

    this.progressState.overallStatus = overallStatus;
    if (errorMessage) {
      this.progressState.errorMessage = errorMessage;
    }

    const { error } = await this.supabase
      .from('background_tasks')
      .update({
        status,
        progress: this.progressState,
        logs: this.logEntries,
        updated_at: now
      })
      .eq('id', this.taskId);

    if (error) {
      await this.supabase
        .from('background_tasks')
        .update({ status, updated_at: now })
        .eq('id', this.taskId);
      this.logDisk('progress', `DB Save fallback used: ${error.message}`, 'WARN');
    }
  }

  private updateStage(key: keyof TaskProgress['stages'], update: Partial<StageProgress>) {
    const current = this.progressState.stages[key] || { status: 'pending' };
    (this.progressState.stages as any)[key] = {
      ...current,
      ...update
    };
  }

  async run(fileUrl: string, fileType: string): Promise<void> {
    const pipelineStartMs = Date.now();
    const uploadTime      = new Date().toISOString();

    this.logDisk('init', '═══════════════════════════════════════════', 'INFO');
    this.logDisk('init', `Upload Started — documentId: ${this.documentId}`, 'INFO');
    this.logDisk('init', `AI Ingestion Pipeline started. TaskId: ${this.taskId}`, 'INFO');
    this.logDisk('init', '═══════════════════════════════════════════', 'INFO');

    try {
      // ── 1. Fetch Document Details ──────────────────────────────────────────
      const { data: doc, error: docErr } = await this.supabase
        .from('documents')
        .select('id, title, content, created_at, subject_id, subjects(name)')
        .eq('id', this.documentId)
        .single();

      if (docErr || !doc) {
        throw new Error(`Document fetch failed: ${docErr?.message || 'Not found'}`);
      }

      const docTitle      = doc.title || 'Lecture Document';
      const docUploadTime = doc.created_at || uploadTime;

      this.logDisk('init', `Document: "${docTitle}" | Upload time: ${docUploadTime}`, 'INFO');

      // ── 2. Extraction Stage ────────────────────────────────────────────────
      this.logDisk('extraction', 'Extraction Started', 'INFO');
      this.updateStage('extraction', { status: 'processing', startTime: new Date().toISOString() });

      const extractionService = new DocumentExtractionService(this.supabase);
      const extractionStartMs = Date.now();

      const extRes = await extractionService.run(
        this.documentId,
        this.userId,
        fileUrl,
        fileType,
        async (status: string) => {
          this.logDisk('extraction', `Stage: ${status}`, 'INFO');
          await this.saveProgress(status);
        }
      );

      const extractionDurationMs = Date.now() - extractionStartMs;

      if (!extRes.success) {
        const errMsg = extRes.errorMessage || 'Text extraction returned an empty result. Processing stopped before chunk generation.';
        this.logDisk('extraction', `Extraction Failed`, 'ERROR');
        this.logDisk('extraction', `Reason: ${errMsg}`, 'ERROR');
        this.updateStage('extraction', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: extractionDurationMs,
          errorMessage: errMsg
        });
        await this.saveProgress('Failed', errMsg);
        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);
        return;
      }

      // Phase 8: Validate extraction output
      PipelineValidator.validateExtraction(extRes.text);

      this.logDisk('extraction', `PDF Stored — file downloaded and validated`, 'INFO');
      this.logDisk('extraction', `Extraction Completed`, 'INFO');
      this.logDisk('extraction', `Characters Extracted: ${extRes.charCount || 0}`, 'INFO');
      this.logDisk('extraction', `Words Extracted: ${extRes.wordCount || 0}`, 'INFO');
      this.logDisk('extraction', `Engine used: ${extRes.methodUsed || 'Unknown'}`, 'INFO');
      this.logDisk('extraction', `Duration: ${(extractionDurationMs / 1000).toFixed(2)}s`, 'INFO');
      this.updateStage('extraction', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: extractionDurationMs
      });

      // ── 3. Chunking Stage ──────────────────────────────────────────────────
      this.logDisk('chunking', 'Chunking Started', 'INFO');
      this.updateStage('chunking', { status: 'processing', startTime: new Date().toISOString() });

      // Idempotency: skip if already chunked (unless forceRun)
      const { data: existingChunks, error: chunkListErr } = await this.supabase
        .from('document_chunks')
        .select('id')
        .eq('document_id', this.documentId);

      if (chunkListErr) {
        throw new Error(`Failed to check existing chunks: ${chunkListErr.message}`);
      }

      const hasChunks      = existingChunks && existingChunks.length > 0;
      const shouldRegenerate = !!this.options.forceRun;

      if (hasChunks && !shouldRegenerate) {
        this.logDisk('chunking', `Document already chunked (${existingChunks.length} chunks found). Skipping — idempotency.`, 'INFO');
        this.updateStage('chunking', { status: 'skipped', endTime: new Date().toISOString() });
        // Jump straight to verification with the existing chunks
      } else {
        if (hasChunks && shouldRegenerate) {
          this.logDisk('chunking', `Force run: deleting ${existingChunks.length} existing chunks...`, 'INFO');
          const { error: delErr } = await this.supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', this.documentId);

          if (delErr) throw new Error(`Failed to clear existing chunks: ${delErr.message}`);
        }

        // Transition status
        await this.saveProgress('Chunking Document');
        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Chunking Document',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        // Load stored knowledge as single source of truth
        this.logDisk('chunking', 'Loading cleaned text from document_knowledge...', 'INFO');
        const { data: knowledge, error: kbError } = await this.supabase
          .from('document_knowledge')
          .select('cleaned_text, subject_id')
          .eq('document_id', this.documentId)
          .single();

        if (kbError || !knowledge || !knowledge.cleaned_text) {
          throw new Error(`Failed to load stored knowledge for chunking: ${kbError?.message || 'Cleaned text is missing'}`);
        }

        const cleanText         = knowledge.cleaned_text;
        const resolvedSubjectId = knowledge.subject_id;

        // Semantic chunking — 4000 char max (~700-800 words), 500 char overlap
        this.logDisk('chunking', 'Executing semantic chunker (max 4000 chars, 500 overlap)...', 'INFO');
        const chunkingStartMs   = Date.now();
        const chunks            = chunkText(cleanText, 4000, 500);
        const chunkingDurationMs = Date.now() - chunkingStartMs;

        // Phase 8: Validate chunking output
        PipelineValidator.validateChunking(chunks);

        const preSaveSeenContent = new Set<string>();
        for (let i = 0; i < chunks.length; i++) {
          if (preSaveSeenContent.has(chunks[i])) {
            throw new Error(`Chunk Generation Failed — Duplicate chunk content at index ${i}.`);
          }
          preSaveSeenContent.add(chunks[i]);
        }

        const numChunks = chunks.length;
        const sizes     = chunks.map(c => c.length);
        const avgSize   = Math.round(sizes.reduce((a, b) => a + b, 0) / numChunks);
        const maxSize   = Math.max(...sizes);
        const minSize   = Math.min(...sizes);

        this.logDisk('chunking', `Chunks Created: ${numChunks}`, 'INFO');
        this.logDisk('chunking', `Avg size: ${avgSize} chars | Max: ${maxSize} | Min: ${minSize} | Duration: ${chunkingDurationMs}ms`, 'INFO');

        // Transition: Saving Chunks
        await this.saveProgress('Saving Chunks');
        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Saving Chunks',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        // Build and insert chunk payloads
        const chunkPayloads = chunks.map((chunk, index) => {
          const charCount = chunk.length;
          const wordCount = chunk.trim().split(/\s+/).filter(Boolean).length;

          let originalHeading: string | null = null;
          const headingMatch = chunk.match(/^(#{1,6}\s+.+)/m);
          if (headingMatch) {
            originalHeading = headingMatch[1].replace(/#{1,6}\s+/, '').trim();
          }

          return {
            document_id: this.documentId,
            subject_id:  resolvedSubjectId || null,
            chunk_index: index,
            content:     chunk,
            embedding:   null, // Phase 2 — Embeddings
            metadata: {
              documentId:        this.documentId,
              subjectId:         resolvedSubjectId || null,
              chunkIndex:        index,
              chunkOrder:        index + 1,
              chunkTitle:        originalHeading || `Chunk ${index + 1}`,
              originalHeading:   originalHeading || null,
              characterCount:    charCount,
              wordCount:         wordCount,
              createdTimestamp:  new Date().toISOString()
            }
          };
        });

        this.logDisk('chunking', `Saving ${chunkPayloads.length} chunks to database...`, 'INFO');
        const { error: dbInsertErr } = await this.supabase
          .from('document_chunks')
          .insert(chunkPayloads);

        if (dbInsertErr) {
          throw new Error(`Chunk Generation Failed — database insert error: ${dbInsertErr.message}`);
        }

        this.logDisk('chunking', `Chunks saved successfully.`, 'INFO');
        this.updateStage('chunking', {
          status: 'completed',
          endTime: new Date().toISOString(),
          durationMs: chunkingDurationMs
        });
      }

      // ── 4. Verification Stage ──────────────────────────────────────────────
      this.logDisk('verification', '───────────────────────────────────────────', 'INFO');
      this.logDisk('verification', 'Verification Started', 'INFO');
      this.updateStage('verification', { status: 'processing', startTime: new Date().toISOString() });

      await this.saveProgress('Verifying Document');
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Verifying Document',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const verifier = new IngestionVerificationService(
        this.supabase,
        this.documentId,
        this.userId,
        this.taskId,
        fileUrl,
        pipelineStartMs
      );

      const report = await verifier.verify();

      // Log every check result
      for (const [checkKey, checkResult] of Object.entries(report.checkResults)) {
        const icon   = checkResult.passed ? '✔' : '✘';
        const suffix = checkResult.passed ? '' : ` — ${checkResult.reason}`;
        this.logDisk('verification', `${icon} ${checkKey}${suffix}`, checkResult.passed ? 'INFO' : 'ERROR');
      }

      if (!report.passed) {
        const failMsg = `Verification Failed — ${report.failedCheck}: ${report.failedReason}`;
        this.logDisk('verification', failMsg, 'ERROR');
        this.updateStage('verification', {
          status: 'failed',
          endTime: new Date().toISOString(),
          errorMessage: failMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.supabase.from('documents').update({
          summary_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', this.documentId);

        await this.saveProgress('Failed', failMsg);
        return;
      }

      // ── 5. Embedding Generation Stage (Phase 2) ──────────────────────────
      this.logDisk('verification', 'Ingestion Verification Passed.', 'INFO');
      
      this.logDisk('embeddings', '═══════════════════════════════════════════', 'INFO');
      this.logDisk('embeddings', 'Knowledge Pipeline Started', 'INFO');
      this.updateStage('embedding', { status: 'processing', startTime: new Date().toISOString() });

      await this.saveProgress('Generating Embeddings');
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Generating Embeddings',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const embeddingService = new EmbeddingService(this.supabase, (stage, msg, lvl) => {
        this.logDisk(stage, msg, lvl || 'INFO');
      });

      const embeddingStartMs = Date.now();
      const embResult = await embeddingService.generateForDocument(
        this.documentId,
        this.userId,
        !!this.options.forceRun
      );
      const embeddingDurationMs = Date.now() - embeddingStartMs;

      if (!embResult.success) {
        const errMsg = embResult.errorMessage || 'Embedding generation failed.';
        this.logDisk('embeddings', `Embedding Generation Failed`, 'ERROR');
        this.logDisk('embeddings', `Reason: ${errMsg}`, 'ERROR');
        this.updateStage('embedding', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: embeddingDurationMs,
          errorMessage: errMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.supabase.from('documents').update({
          summary_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', this.documentId);

        await this.saveProgress('Failed', errMsg);
        return;
      }

      // Phase 8: Validate embedding output
      if (embResult.success && !embResult.skipped) {
        PipelineValidator.validateEmbeddings(embResult.totalChunks, embResult.embeddingsGenerated);
      }

      this.updateStage('embedding', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: embeddingDurationMs
      });

      // ── 6. Knowledge Verification Stage (Phase 2) ─────────────────────────
      this.logDisk('knowledgeVerify', '───────────────────────────────────────────', 'INFO');
      this.logDisk('knowledgeVerify', 'Knowledge Verification Started', 'INFO');
      this.updateStage('knowledgeVerify', { status: 'processing', startTime: new Date().toISOString() });

      await this.saveProgress('Verifying Knowledge');
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Verifying Knowledge',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const knowledgeVerifier = new EmbeddingVerificationService(
        this.supabase,
        this.documentId,
        this.userId
      );

      const knowledgeReport = await knowledgeVerifier.verify();

      // Log every knowledge check result
      for (const [checkKey, checkResult] of Object.entries(knowledgeReport.checkResults)) {
        const icon = checkResult.passed ? '✔' : '✘';
        const suffix = checkResult.passed ? '' : ` — ${checkResult.reason}`;
        this.logDisk('knowledgeVerify', `${icon} ${checkKey}${suffix}`, checkResult.passed ? 'INFO' : 'ERROR');
      }

      if (!knowledgeReport.passed) {
        const failMsg = `Knowledge Verification Failed — ${knowledgeReport.failedCheck}: ${knowledgeReport.failedReason}`;
        this.logDisk('knowledgeVerify', failMsg, 'ERROR');
        this.updateStage('knowledgeVerify', {
          status: 'failed',
          endTime: new Date().toISOString(),
          errorMessage: failMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.supabase.from('documents').update({
          summary_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', this.documentId);

        await this.saveProgress('Failed', failMsg);
        return;
      }

      this.logDisk('knowledgeVerify', 'Embeddings Verified', 'INFO');
      this.logDisk('knowledgeVerify', 'Knowledge Base Ready', 'INFO');
      this.updateStage('knowledgeVerify', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: Date.now() - embeddingStartMs
      });

      this.logDisk('knowledgeVerify', 'Embeddings Verified', 'INFO');
      this.logDisk('knowledgeVerify', 'Knowledge Base Ready', 'INFO');
      this.updateStage('knowledgeVerify', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: Date.now() - embeddingStartMs
      });

      // ── 7. Complete Knowledge Ready ─────────────────────────────────────────
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Knowledge Ready',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const resolvedSubjectId = doc.subject_id;
      const subjectName       = (doc.subjects as any)?.name || 'General';

      // ── 8. Summary Generation ──────────────────────────────────────────────
      this.logDisk('summaryGen', 'Summary Generation Started', 'INFO');
      this.updateStage('summaryGen', { status: 'processing', startTime: new Date().toISOString() });

      await this.saveProgress('Generating Summary');
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Generating Summary',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const summaryStartMs = Date.now();
      const summaryResult = await SummarySkillService.run({
        documentId: this.documentId,
        userId: this.userId,
        mode: 'detailed',
        forceRegenerate: !!this.options.forceRun,
        supabase: this.supabase
      });
      const summaryDurationMs = Date.now() - summaryStartMs;

      if (!summaryResult.success || !summaryResult.summary) {
        const errMsg = summaryResult.errorMessage || 'Summary generation returned an empty result.';
        this.logDisk('summaryGen', 'Summary Generation Failed', 'ERROR');
        this.logDisk('summaryGen', `Failure Details — document: ${this.documentId}, user: ${this.userId}, stage: summaryGen, duration: ${summaryDurationMs}ms, reason: ${errMsg}`, 'ERROR');
        this.updateStage('summaryGen', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: summaryDurationMs,
          errorMessage: errMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'Summary Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.saveProgress('Failed', errMsg);
        return;
      }

      this.logDisk('summaryGen', 'Summary Generated Successfully', 'INFO');
      this.logDisk('summaryGen', 'Summary Saved', 'INFO');
      this.updateStage('summaryGen', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: summaryDurationMs
      });

      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Summary Generated',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      // ── 9. PDF Rendering & Storage ─────────────────────────────────────────
      this.logDisk('pdfRender', 'PDF Rendering Started', 'INFO');
      this.updateStage('pdfRender', { status: 'processing', startTime: new Date().toISOString() });

      await this.saveProgress('Rendering PDF');
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Rendering PDF',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      const pdfStartMs = Date.now();
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generateSummaryPDF(summaryResult.summary, docTitle, subjectName);
        this.logDisk('pdfRender', 'PDF Generated', 'INFO');
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        this.logDisk('pdfRender', 'PDF Rendering Failed', 'ERROR');
        this.logDisk('pdfRender', `Failure Details — document: ${this.documentId}, user: ${this.userId}, stage: pdfRender, duration: ${Date.now() - pdfStartMs}ms, reason: ${errMsg}`, 'ERROR');
        this.updateStage('pdfRender', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: Date.now() - pdfStartMs,
          errorMessage: errMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'PDF Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.saveProgress('Failed', errMsg);
        return;
      }

      // Upload PDF to Supabase Storage
      this.logDisk('pdfRender', 'Uploading PDF', 'INFO');
      const ts = Date.now();
      const pdfStoragePath = `${this.userId}/ai-gen-${ts}-${this.documentId.substring(0, 8)}-summary.pdf`;
      const { error: upErr } = await this.supabase.storage
        .from('documents')
        .upload(pdfStoragePath, pdfBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (upErr) {
        const errMsg = `Upload failed for PDF: ${upErr.message}`;
        this.logDisk('pdfRender', 'PDF Rendering Failed', 'ERROR');
        this.logDisk('pdfRender', `Failure Details — document: ${this.documentId}, user: ${this.userId}, stage: pdfRender, duration: ${Date.now() - pdfStartMs}ms, reason: ${errMsg}`, 'ERROR');
        this.updateStage('pdfRender', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: Date.now() - pdfStartMs,
          errorMessage: errMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'PDF Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.saveProgress('Failed', errMsg);
        return;
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from('documents')
        .getPublicUrl(pdfStoragePath);

      // ── Old PDF Cleanup (Version Storage Optimisation) ─────────────────────
      // Now that the new PDF is safely uploaded, scan storage for any stale
      // summary PDFs from previous AI_GENERATION_VERSION runs and delete them.
      // Pattern: {userId}/ai-gen-*-{docId8}-summary.pdf
      // We only delete AFTER the new file is confirmed in storage.
      const docId8 = this.documentId.substring(0, 8);

      try {
        // List all files in the user's folder
        const { data: storageFiles, error: listErr } = await this.supabase.storage
          .from('documents')
          .list(this.userId, { limit: 500 });

        if (!listErr && storageFiles) {
          // Match files that are summary PDFs for this specific document
          const staleFiles = storageFiles
            .filter((f: any) => {
              const name: string = f.name || '';
              return (
                name.includes(`-${docId8}-summary.pdf`) &&
                name.startsWith('ai-gen-') &&
                `${this.userId}/${name}` !== pdfStoragePath  // exclude the new file
              );
            })
            .map((f: any) => `${this.userId}/${f.name}`);

          if (staleFiles.length > 0) {
            this.logDisk('pdfRender', `Cleaning up ${staleFiles.length} stale summary PDF(s) from storage...`, 'INFO');
            const { error: rmErr } = await this.supabase.storage
              .from('documents')
              .remove(staleFiles);

            if (rmErr) {
              // Non-fatal — log and continue. New PDF is already stored safely.
              this.logDisk('pdfRender', `Old PDF cleanup warning (non-fatal): ${rmErr.message}`, 'WARN');
            } else {
              this.logDisk('pdfRender', `Old PDF cleanup complete. Removed: ${staleFiles.join(', ')}`, 'INFO');
            }
          } else {
            this.logDisk('pdfRender', 'No stale summary PDFs found — storage already clean.', 'INFO');
          }
        }
      } catch (cleanupErr: any) {
        // Never block the pipeline for cleanup failures
        this.logDisk('pdfRender', `Old PDF cleanup skipped (non-fatal): ${cleanupErr?.message}`, 'WARN');
      }

      // Save PDF via FolderSyncService

      const pdfResult: GeneratedPdfResult = {
        key: 'summary',
        displayName: 'Summary',
        suffixName: 'Summary',
        storagePath: pdfStoragePath,
        publicUrl,
        size: pdfBuffer.length,
        customFileName: 'Summary.pdf'
      };

      try {
        const folderSyncService = new FolderSyncService(this.supabase);
        await folderSyncService.run(this.userId, resolvedSubjectId, docTitle, [pdfResult], subjectName);
        this.logDisk('pdfRender', 'PDF Stored', 'INFO');
      } catch (err: any) {
        const errMsg = `Folder sync failed: ${err.message}`;
        this.logDisk('pdfRender', 'PDF Rendering Failed', 'ERROR');
        this.logDisk('pdfRender', `Failure Details — document: ${this.documentId}, user: ${this.userId}, stage: pdfRender, duration: ${Date.now() - pdfStartMs}ms, reason: ${errMsg}`, 'ERROR');
        this.updateStage('pdfRender', {
          status: 'failed',
          endTime: new Date().toISOString(),
          durationMs: Date.now() - pdfStartMs,
          errorMessage: errMsg
        });

        await this.supabase.from('document_knowledge').update({
          current_processing_stage: 'PDF Failed',
          updated_at: new Date().toISOString()
        }).eq('document_id', this.documentId);

        await this.saveProgress('Failed', errMsg);
        return;
      }

      const pdfDurationMs = Date.now() - pdfStartMs;
      this.updateStage('pdfRender', {
        status: 'completed',
        endTime: new Date().toISOString(),
        durationMs: pdfDurationMs
      });

      // ── 10. Complete ────────────────────────────────────────────────────────
      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Completed',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId);

      this.logDisk('init', 'Pipeline Completed', 'INFO');
      await this.saveProgress('Completed');

      this.logDisk('init', '═══════════════════════════════════════════', 'INFO');
      this.logDisk('init', `Processing Completed — "${docTitle}"`, 'INFO');
      this.logDisk('init', '═══════════════════════════════════════════', 'INFO');

    } catch (err: any) {
      const errMsg = err?.message || String(err);

      if (errMsg === 'TASK_CANCELLED') {
        this.logDisk('fatal', 'Pipeline aborted — task was cancelled.', 'WARN');
        return;
      }

      this.logDisk('fatal', `Pipeline encountered a fatal error: ${errMsg}`, 'ERROR');
      this.logDisk('fatal', `Total elapsed: ${((Date.now() - pipelineStartMs) / 1000).toFixed(2)}s`, 'ERROR');

      await this.supabase.from('document_knowledge').update({
        current_processing_stage: 'Failed',
        updated_at: new Date().toISOString()
      }).eq('document_id', this.documentId).maybeSingle();

      await this.saveProgress('Failed', errMsg).catch(() => {});
    }
  }
}

