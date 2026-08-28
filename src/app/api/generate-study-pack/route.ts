import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { UserPreferences } from '@/lib/preferences';
import { logger } from '@/lib/logger';
import { dispatchStudyPackGeneration } from '@/services/ai/pipeline/study-pack-dispatcher';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { documentId, fileUrl, fileType, force } = await request.json();

    if (!documentId || !fileUrl || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const serverSupabase = await createClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

    // Load User Preferences from Cookie
    const cookieStore = await cookies();
    const cookieName = `neuron_pref_${userId}`;
    const cookieVal = cookieStore.get(cookieName)?.value;
    let preferences: UserPreferences | undefined;
    if (cookieVal) {
      try {
        preferences = JSON.parse(decodeURIComponent(cookieVal)) as UserPreferences;
      } catch (err) {
        logger.warn('[generate-study-pack] Failed to parse preferences cookie:', err);
      }
    }

    const result = await dispatchStudyPackGeneration({
      supabase: serverSupabase,
      userId,
      documentId,
      fileUrl,
      fileType,
      force: !!force,
      preferences,
    });

    const reqDuration = Date.now() - startTime;
    logger.info(`[generate-study-pack] Dispatched document ${documentId} in ${reqDuration}ms: status=${result.status}, jobId=${result.jobId}`);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message || 'Dispatch failed', taskId: result.taskId },
        { status: result.status === 'error' ? 500 : 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        jobId: result.jobId,
        taskId: result.taskId,
        status: result.status,
        message: result.message,
        deduplicated: result.deduplicated,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    logger.error('[generate-study-pack] Route handler crashed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

