import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { UserPreferences } from '@/lib/preferences';
import { logger } from '@/lib/logger';
import { JobRecoveryService } from '@/services/ai/pipeline/job-recovery-service';
import { enqueueStudyPackJob } from '@/lib/queue/study-pack-queue';
import * as crypto from 'crypto';

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

    // getSession() used only to retrieve tokens for the background scheduler's setSession() call,
    // NOT for identity verification (handled securely by getUser() above).
    const { data: { session } } = await serverSupabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Verify document exists, belongs to user, and has a subject assigned
    const { data: doc, error: docErr } = await serverSupabase
      .from('documents')
      .select('id, subject_id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (docErr || !doc) {
      logger.error('[generate-study-pack] Failed to fetch document: ' + (docErr?.message || 'Not found'));
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!doc.subject_id) {
      logger.error('[generate-study-pack] Document lacks a subject_id.');
      return NextResponse.json({ error: 'Document lacks a subject' }, { status: 400 });
    }

    // ── Watchdog Auto-Recovery for Stale / Crashed Tasks ───────────────────────
    await JobRecoveryService.recoverStaleJobs(serverSupabase, userId);

    // ── Status Constants & Classification ──────────────────────────────────────
    const PENDING_STATUS = 'pending';
    const QUEUED_STATUS = 'Queued';

    // Idempotency check on background_tasks
    const { data: existing } = await serverSupabase
      .from('background_tasks')
      .select('id, status')
      .eq('user_id',    userId)
      .eq('document_id', documentId)
      .eq('task_type',  'study_pack')
      .maybeSingle();

    let taskId: string;
    let shouldDispatch = false;

    if (!existing) {
      // ── Case A: No existing task ───────────────────────────────────────────
      // Two concurrent requests may both see no existing row and both attempt an
      // insert. The database unique constraint on (user_id, document_id, task_type)
      // ensures only one insert succeeds. The loser gets error code 23505.
      taskId = crypto.randomUUID();
      const { error: insertErr } = await serverSupabase.from('background_tasks').insert({
        id:          taskId,
        user_id:     userId,
        document_id: documentId,
        task_type:   'study_pack',
        status:      QUEUED_STATUS,
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          // ── Race condition: another concurrent request already inserted this task.
          // Re-fetch the existing record and apply Phase 2B-1 state decision logic.
          console.log(`[StudyPackDispatch] document=${documentId} action=concurrent_insert_race — re-fetching winner`);
          const { data: raceWinner, error: refetchErr } = await serverSupabase
            .from('background_tasks')
            .select('id, status')
            .eq('user_id',     userId)
            .eq('document_id', documentId)
            .eq('task_type',   'study_pack')
            .maybeSingle();

          if (refetchErr || !raceWinner) {
            logger.error('[generate-study-pack] Failed to re-fetch task after 23505 race: ' + (refetchErr?.message ?? 'not found'));
            return NextResponse.json({ error: 'Task creation conflict — please retry' }, { status: 500 });
          }

          // Reuse the race-winner's ID and fall through to the existing-task branch
          taskId = raceWinner.id;
          const raceStatus = raceWinner.status || '';
          const raceNormalized = raceStatus.toLowerCase().trim();

          if (raceNormalized === PENDING_STATUS || raceNormalized === 'queued') {
            // The winner task is still waiting — safe to (re)dispatch if pending
            if (raceNormalized === PENDING_STATUS) {
              await serverSupabase.from('background_tasks')
                .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
                .eq('id', taskId);
              console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=pending action=race_transition_to_queued_and_dispatch`);
              shouldDispatch = true;
            } else {
              console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${raceStatus} action=race_already_queued`);
              return NextResponse.json({ success: true, message: 'Already queued', taskId }, { status: 200 });
            }
          } else if (raceNormalized === 'completed') {
            console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${raceStatus} action=race_already_completed`);
            return NextResponse.json({ success: true, message: 'Already completed', taskId }, { status: 200 });
          } else if (raceNormalized === 'failed') {
            console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${raceStatus} action=race_no_auto_retry`);
            return NextResponse.json({ success: false, message: 'Task failed previously', taskId }, { status: 200 });
          } else if (raceNormalized === 'cancelled') {
            console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${raceStatus} action=race_cancelled`);
            return NextResponse.json({ success: false, message: 'Task cancelled', taskId }, { status: 200 });
          } else {
            // Actively processing
            console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${raceStatus} action=race_already_processing`);
            return NextResponse.json({ success: true, message: 'Already processing', taskId }, { status: 200 });
          }
        } else {
          // Non-conflict insert error — genuine failure
          logger.error('[generate-study-pack] background_tasks insert failed: ' + insertErr.message);
          return NextResponse.json({ error: 'Task creation failed', detail: insertErr.message }, { status: 500 });
        }
      } else {
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=none action=create_and_dispatch`);
        shouldDispatch = true;
      }
    } else {
      taskId = existing.id;
      const rawStatus = existing.status || '';
      const normalizedStatus = rawStatus.toLowerCase().trim();

      // If force is requested, allow re-running regardless of existing state
      if (force) {
        const { error: updateErr } = await serverSupabase.from('background_tasks')
          .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
          .eq('id', taskId);

        if (updateErr) {
          logger.error('[generate-study-pack] Force update failed: ' + updateErr.message);
          return NextResponse.json({ error: 'Task update failed', detail: updateErr.message }, { status: 500 });
        }

        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=force_requeue_and_dispatch`);
        shouldDispatch = true;
      } else if (normalizedStatus === PENDING_STATUS) {
        // ── Case B: Existing task is 'pending' (Fresh upload awaiting dispatch) ──
        const { error: updateErr } = await serverSupabase.from('background_tasks')
          .update({ status: QUEUED_STATUS, updated_at: new Date().toISOString() })
          .eq('id', taskId);

        if (updateErr) {
          logger.error('[generate-study-pack] Transition pending->Queued failed: ' + updateErr.message);
          return NextResponse.json({ error: 'Task queue transition failed', detail: updateErr.message }, { status: 500 });
        }

        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=pending action=transition_to_queued_and_dispatch`);
        shouldDispatch = true;
      } else if (normalizedStatus === 'queued') {
        // ── Case C: Existing task is already 'Queued' ──────────────────────────
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=already_queued`);
        return NextResponse.json({ success: true, message: 'Already queued', taskId }, { status: 200 });
      } else if (normalizedStatus === 'completed') {
        // ── Case E: Existing task is 'Completed' ───────────────────────────────
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=already_completed`);
        return NextResponse.json({ success: true, message: 'Already completed', taskId }, { status: 200 });
      } else if (normalizedStatus === 'failed') {
        // ── Case F: Existing task is 'Failed' (No automatic retry) ─────────────
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=no_auto_retry`);
        return NextResponse.json({ success: false, message: 'Task failed previously', taskId }, { status: 200 });
      } else if (normalizedStatus === 'cancelled') {
        // ── Case G: Existing task is 'Cancelled' ───────────────────────────────
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=cancelled`);
        return NextResponse.json({ success: false, message: 'Task cancelled', taskId }, { status: 200 });
      } else {
        // ── Case D: Existing task is actively processing ───────────────────────
        console.log(`[StudyPackDispatch] document=${documentId} task=${taskId} status=${rawStatus} action=already_processing`);
        return NextResponse.json({ success: true, message: 'Already processing', taskId }, { status: 200 });
      }
    }

    if (!shouldDispatch) {
      return NextResponse.json({ success: true, jobId: null, taskId, status: 'queued' }, { status: 200 });
    }

    // ── Phase 1: Enqueue via BullMQ (replaces setImmediate) ─────────────────
    // The worker independently processes the job — this route returns immediately.
    const { jobId, deduplicated } = await enqueueStudyPackJob({
      jobId: taskId, // stable identity key
      taskId,
      userId,
      documentId,
      fileUrl,
      fileType,
      force: !!force,
      preferences,
    });

    const reqDuration = Date.now() - startTime;
    logger.info(`[generate-study-pack] Task ${taskId} enqueued as BullMQ job ${jobId} in ${reqDuration}ms (deduplicated=${deduplicated})`);

    return NextResponse.json({ success: true, jobId, taskId, status: 'queued' }, { status: 200 });

  } catch (err: unknown) {
    logger.error('[generate-study-pack] Route handler crashed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
