/**
 * POST /api/examples
 *
 * Production examples API route — Phase 12.
 * Handles auth, document ownership, and delegates to ExamplesSkillService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { ExamplesSkillService } from '@/services/ai/pipeline/examples-skill-service';

export async function POST(request: NextRequest) {
  try {
    const { documentId, forceRegenerate } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      return NextResponse.json({ error: 'Document processing failed. Cannot generate examples.' }, { status: 422 });
    }

    logger.info(`[API][Examples] Delegating doc: [${documentId}] to ExamplesSkillService.`);

    const result = await ExamplesSkillService.run({
      documentId,
      userId: user.id,
      forceRegenerate: !!forceRegenerate,
      supabase
    });

    if (!result.success) {
      return NextResponse.json({ error: result.errorMessage || 'Examples generation failed.' }, { status: 502 });
    }

    return NextResponse.json({
      examples: result.examples || [],
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
    logger.error('[API][Examples] Critical failure:', error);
    return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
  }
}
