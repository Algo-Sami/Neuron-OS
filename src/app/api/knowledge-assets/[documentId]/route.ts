/**
 * GET /api/knowledge-assets/[documentId]
 *
 * Returns the complete Knowledge Asset collection for a lecture.
 * Only returns asset metadata — NOT full content.
 * Content is fetched separately via the skill-specific endpoints
 * (e.g., GET /api/summarize, GET /api/flashcards).
 *
 * This endpoint backs the "AI Generated" folder view in the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { KnowledgeAssetRegistry } from '@/services/ai/pipeline/knowledge-asset-registry';

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

    // ── Fetch asset collection via registry ─────────────────────────────────

    logger.info(`[KnowledgeAssetsAPI] Fetching asset collection for Document [${documentId}]`);

    const collection = await KnowledgeAssetRegistry.getAssetCollection(
      supabase,
      documentId,
      user.id
    );

    return NextResponse.json({
      documentId: collection.documentId,
      documentTitle: collection.documentTitle,
      totalAssets: collection.totalAssets,
      readyAssets: collection.readyAssets,
      assets: collection.assets
    });

  } catch (error: unknown) {
    logger.error('[KnowledgeAssetsAPI] Request failed:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
