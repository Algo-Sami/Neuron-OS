/**
 * POST /api/key-points
 *
 * Production key points API route — Phase 10.
 *
 * Checks auth, ownership, and delegates key points generation to
 * KeyPointsSkillService, which manages retrieval priority and asset registries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { KeyPointsSkillService } from '@/services/ai/pipeline/key-points-skill-service';

export async function POST(request: NextRequest) {
  try {
    const { documentId, forceRegenerate } = await request.json();

    // ── Validation ──────────────────────────────────────────────────────────

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    // ── Auth ────────────────────────────────────────────────────────────────

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Ownership ────────────────────────────────────────────────────────────

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, summary_status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    if (document.summary_status === 'failed') {
      return NextResponse.json(
        { error: 'Document processing failed. Cannot generate key points.' },
        { status: 422 }
      );
    }

    // ── Pipeline delegation ──────────────────────────────────────────────────

    logger.info(`[API][KeyPoints] Delegating doc: [${documentId}] to KeyPointsSkillService. forceRegen: ${!!forceRegenerate}`);

    const result = await KeyPointsSkillService.run({
      documentId,
      userId: user.id,
      forceRegenerate: !!forceRegenerate,
      supabase
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || 'Key points generation failed.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      lectureTitle: result.lectureTitle,
      keyPoints: result.keyPoints,
      importantFacts: result.importantFacts,
      quickRevisionTips: result.quickRevisionTips,
      createdAt: result.createdAt,
      cached: result.cached,
      assetId: result.assetId,
      assetVersion: result.assetVersion,
      meta: {
        confidenceScore: result.confidenceScore,
        confidenceLabel: result.confidenceLabel,
        sourcesUsed: result.sourcesUsed
      }
    });

  } catch (error: unknown) {
    logger.error('[API][KeyPoints] Critical failure in route:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
