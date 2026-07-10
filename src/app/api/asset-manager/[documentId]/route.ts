/**
 * GET /api/asset-manager/[documentId]
 *
 * Production status endpoint for the AI Asset Generation Manager — Phase 9.
 *
 * Returns the complete generation state map for a lecture, including:
 *   - Current status of all possible asset types (missing, queued, running, ready, failed, outdated).
 *   - canGenerate & prerequisitesMet flags.
 *   - Error messages for failed assets.
 *   - Active generation jobs.
 *
 * Backs the UI "AI Generated" collection views.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { AssetGenerationManager } from '@/services/ai/pipeline/asset-generation-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    // ── Auth ────────────────────────────────────────────────────────────────

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Document ownership check ─────────────────────────────────────────────

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title')
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

    // ── Query state map via Generation Manager ──────────────────────────────

    logger.info(`[AssetManagerAPI] Fetching state map for Document [${documentId}]`);

    const assets = await AssetGenerationManager.getAssetStateMap(
      supabase,
      user.id,
      documentId
    );

    return NextResponse.json({
      documentId,
      documentTitle: document.title,
      assets
    });

  } catch (error: unknown) {
    logger.error('[AssetManagerAPI] Request failed:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
