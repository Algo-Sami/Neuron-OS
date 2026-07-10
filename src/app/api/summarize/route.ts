/**
 * POST /api/summarize
 *
 * Production summary API route — Phase 7.
 *
 * All generation logic is delegated to SummarySkillService which drives
 * the full AI pipeline:
 *   Phase 3 (Retrieval) → Phase 4 (Context Builder) → Phase 5 (Response Engine)
 *
 * This route is responsible ONLY for:
 *   - Auth and request validation
 *   - Document ownership verification
 *   - Delegating to SummarySkillService
 *   - Returning the standard HTTP response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { SummarySkillService, SummaryMode } from '@/services/ai/pipeline/summary-skill-service';

const VALID_MODES: SummaryMode[] = [
  'beginner',
  'concise',
  'detailed',
  'exam-focused',
  'bullet',
  'key-concepts'
];

export async function POST(request: NextRequest) {
  try {
    const { documentId, mode, forceRegenerate } = await request.json();

    // ── Request validation ────────────────────────────────────────────────────

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    if (!mode || !VALID_MODES.includes(mode as SummaryMode)) {
      return NextResponse.json(
        { error: `Invalid summary mode. Must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Document ownership verification ───────────────────────────────────────

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, summary_status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    if (document.summary_status === 'failed') {
      return NextResponse.json(
        { error: 'Document analysis failed. Please delete and re-upload this file.' },
        { status: 422 }
      );
    }

    // ── Delegate to SummarySkillService (Phase 7) ─────────────────────────────

    logger.info(`[Summarize] Delegating to SummarySkillService. Doc: [${documentId}], Mode: [${mode}], ForceRegen: [${!!forceRegenerate}]`);

    const result = await SummarySkillService.run({
      documentId,
      userId: user.id,
      mode: mode as SummaryMode,
      forceRegenerate: !!forceRegenerate,
      supabase
    });

    if (!result.success) {
      logger.error(`[Summarize] SummarySkillService failed: ${result.errorMessage}`);
      return NextResponse.json(
        { error: result.errorMessage || 'Summary generation failed. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      summary: result.summary,
      keyPoints: result.keyPoints || [],
      createdAt: result.createdAt || new Date().toISOString(),
      cached: result.cached ?? false,
      // Optional observability fields
      meta: {
        retrievalChunks: result.retrievalChunks,
        confidenceScore: result.confidenceScore,
        confidenceLabel: result.confidenceLabel,
        sourcesUsed: result.sourcesUsed
      }
    });

  } catch (error: unknown) {
    logger.error('[Summarize] Critical route handler failure:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
