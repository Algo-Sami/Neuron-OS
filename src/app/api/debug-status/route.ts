/**
 * GET /api/debug-status
 *
 * Internal developer debug view for the Phase 2 Document Knowledge Layer.
 * Shows per-document processing status, extraction metrics, validation results,
 * and failure details from both the document_knowledge table and documents table.
 *
 * This is NOT a user-facing endpoint — it is for developer diagnostics only
 * during pipeline stabilization.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 1. Fetch documents (core records) ────────────────────────────────────
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('id, title, summary_status, quiz_status, created_at, tags, classification_status, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // ── 2. Fetch document_knowledge records (Phase 2 pipeline status) ─────────
    let knowledgeRecords: any[] = [];
    let knowledgeError: any = null;
    let knowledgeTableAvailable = false;

    try {
      const { data: knowledge, error: kErr } = await supabase
        .from('document_knowledge')
        .select(
          'id, document_id, current_processing_stage, extraction_status, validation_status, ' +
          'storage_status, extraction_engine, character_count, word_count, estimated_reading_time, ' +
          'heading_count, paragraph_count, processing_duration, retry_count, ' +
          'error_message, validation_failure_reason, metadata, logs, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (kErr) {
        knowledgeError = kErr.message;
        // PGRST205 means the table doesn't exist yet — that's acceptable
        knowledgeTableAvailable = !(kErr.code === 'PGRST205' || kErr.message?.includes('schema cache'));
      } else {
        knowledgeRecords = knowledge || [];
        knowledgeTableAvailable = true;
      }
    } catch (e: any) {
      knowledgeError = e?.message || String(e);
    }

    // ── 3. Build knowledge map by document_id for quick lookup ────────────────
    const knowledgeByDoc: Record<string, any> = {};
    for (const kr of knowledgeRecords) {
      knowledgeByDoc[kr.document_id] = kr;
    }

    // ── 4. Fetch document_chunks counts ───────────────────────────────────────
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('document_id');

    const chunkCounts: Record<string, number> = {};
    if (chunks) {
      for (const c of chunks) {
        chunkCounts[c.document_id] = (chunkCounts[c.document_id] || 0) + 1;
      }
    }

    // ── 5. Fetch background_tasks (pipeline execution records) ─────────────────
    const { data: tasks, error: taskError } = await supabase
      .from('background_tasks')
      .select('id, document_id, task_type, status, progress, logs, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    const tasksByDoc: Record<string, any[]> = {};
    if (tasks) {
      for (const t of tasks) {
        if (!tasksByDoc[t.document_id]) tasksByDoc[t.document_id] = [];
        tasksByDoc[t.document_id].push(t);
      }
    }

    // ── 6. Compose per-document debug report ─────────────────────────────────
    const report = (docs || []).map((doc) => {
      const knowledge = knowledgeByDoc[doc.id];
      const docTasks  = tasksByDoc[doc.id] || [];
      const latestTask = docTasks[0] || null;
      const hasContent = !!(doc.content && doc.content.length > 0);

      return {
        // Document basics
        documentId:        doc.id,
        title:             doc.title,
        classificationStatus: doc.classification_status,
        summaryStatus:     doc.summary_status,
        createdAt:         doc.created_at,

        // Text storage
        hasStoredText:     hasContent,
        storedTextLength:  doc.content?.length || 0,

        // Phase 2 Knowledge Layer
        knowledgeLayer: knowledge
          ? {
              stage:                    knowledge.current_processing_stage,
              extractionStatus:         knowledge.extraction_status,
              validationStatus:         knowledge.validation_status,
              storageStatus:            knowledge.storage_status,
              extractionEngine:         knowledge.extraction_engine,
              characterCount:           knowledge.character_count,
              wordCount:                knowledge.word_count,
              estimatedReadingTimeMins: knowledge.estimated_reading_time,
              headingCount:             knowledge.heading_count,
              paragraphCount:           knowledge.paragraph_count,
              processingDurationMs:     knowledge.processing_duration,
              retryCount:               knowledge.retry_count,
              errorMessage:             knowledge.error_message,
              validationFailureReason:  knowledge.validation_failure_reason,
              metadata:                 knowledge.metadata,
              lastUpdated:              knowledge.updated_at,
              // Include full logs for developer review
              logs:                     knowledge.logs,
            }
          : null,

        // Background task pipeline
        pipeline: latestTask
          ? {
              taskId:     latestTask.id,
              taskType:   latestTask.task_type,
              status:     latestTask.status,
              updatedAt:  latestTask.updated_at,
              // Show last 10 log entries from the task
              recentLogs: Array.isArray(latestTask.logs)
                ? latestTask.logs.slice(-10)
                : [],
            }
          : null,

        // Chunk counts
        chunksCount: chunkCounts[doc.id] || 0,
      };
    });

    // ── 7. Summary statistics ─────────────────────────────────────────────────
    const totalDocs          = report.length;
    const docsWithText       = report.filter(r => r.hasStoredText).length;
    const docsWithKnowledge  = report.filter(r => r.knowledgeLayer !== null).length;
    const successfulKnowledge = report.filter(r => r.knowledgeLayer?.extractionStatus === 'success').length;
    const failedKnowledge    = report.filter(r => r.knowledgeLayer?.extractionStatus === 'failed').length;
    const pendingKnowledge   = report.filter(r => !r.knowledgeLayer || r.knowledgeLayer.extractionStatus === 'pending').length;

    return NextResponse.json({
      debug: true,
      user: user.email,
      knowledgeTableAvailable,
      knowledgeTableError: knowledgeError || null,
      summary: {
        totalDocuments:           totalDocs,
        documentsWithStoredText:  docsWithText,
        documentsWithKnowledge:   docsWithKnowledge,
        successfulExtractions:    successfulKnowledge,
        failedExtractions:        failedKnowledge,
        pendingExtractions:       pendingKnowledge,
      },
      errors: {
        docError:  docError?.message  || null,
        taskError: taskError?.message || null,
      },
      documents: report,
    });

  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
