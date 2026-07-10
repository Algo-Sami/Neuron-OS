/**
 * POST /api/definitions
 *
 * Production glossary definitions API route — Phase 11.
 *
 * Handles auth, ownership check, and delegates glossary generation
 * to DefinitionsSkillService, which manages retrieval priority and asset registry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { DefinitionsSkillService } from '@/services/ai/pipeline/definitions-skill-service';

export async function POST(request: NextRequest) {
  try {
    const { documentId, forceRegenerate } = await request.json();

    // ── Request Validation ───────────────────────────────────────────────────

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    // ── Auth ────────────────────────────────────────────────────────────────

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Ownership Verification ───────────────────────────────────────────────

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
        { error: 'Document processing failed. Cannot generate definitions.' },
        { status: 422 }
      );
    }

    // ── Pipeline delegation ──────────────────────────────────────────────────

    logger.info(`[API][Definitions] Delegating doc: [${documentId}] to DefinitionsSkillService. forceRegen: ${!!forceRegenerate}`);

    const result = await DefinitionsSkillService.run({
      documentId,
      userId: user.id,
      forceRegenerate: !!forceRegenerate,
      supabase
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || 'Definitions generation failed.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      glossary: result.glossary || [],
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
    logger.error('[API][Definitions] Critical failure in route:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
