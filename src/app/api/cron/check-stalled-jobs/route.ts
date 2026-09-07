import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Cron Handler — Stalled Job Alert Check.
 *
 * Detects jobs that have been sitting in `Queued` or `processing` too long
 * without being picked up or heartbeated by a worker. Emits ERROR-level log
 * lines visible in Railway's log dashboard so a human can investigate.
 *
 * This is purely observational — it does NOT recover or reset any tasks.
 * JobRecoveryService's existing sweep handles actual recovery when a new job
 * is dispatched or the worker starts up.
 *
 * Trigger: external scheduler (e.g. Railway cron, cron-job.org) calling GET
 * every 5 minutes with Authorization: Bearer <CRON_SECRET>.
 *
 * Staleness thresholds (must match JobRecoveryService definitions):
 *   - Queued: no activity (heartbeat_at, updated_at, or created_at) for > 5 min
 *   - processing: heartbeat_at not updated for > 2 min (JobRecoveryService's own threshold)
 */

// Stall thresholds — keep in sync with JobRecoveryService semantics
const QUEUED_STALL_THRESHOLD_MS = 5 * 60 * 1000;    // 5 minutes
const PROCESSING_STALL_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes (matches JobRecoveryService)

function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('[StalledJobCheck] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();

  try {
    const supabase = createServiceSupabase();
    const now = Date.now();

    // ── 1. Stalled Queued jobs ──────────────────────────────────────────────
    const { data: queuedTasks, error: queuedErr } = await supabase
      .from('background_tasks')
      .select('id, document_id, user_id, status, heartbeat_at, updated_at, created_at, locked_by, attempts')
      .eq('status', 'Queued');

    if (queuedErr) {
      logger.error('[StalledJobCheck] Error querying Queued tasks:', queuedErr.message);
      return NextResponse.json({ error: 'DB query failed (Queued)' }, { status: 500 });
    }

    const stalledQueued = (queuedTasks ?? []).filter((t) => {
      const heartbeat = t.heartbeat_at ? new Date(t.heartbeat_at).getTime() : 0;
      const updated   = t.updated_at   ? new Date(t.updated_at).getTime()   : 0;
      const created   = t.created_at   ? new Date(t.created_at).getTime()   : 0;
      const lastActivity = Math.max(heartbeat, updated, created);
      return now - lastActivity > QUEUED_STALL_THRESHOLD_MS;
    });

    // ── 2. Stalled processing jobs (stale heartbeat) ────────────────────────
    const { data: processingTasks, error: processingErr } = await supabase
      .from('background_tasks')
      .select('id, document_id, user_id, status, heartbeat_at, updated_at, created_at, locked_by, attempts')
      .eq('status', 'processing');

    if (processingErr) {
      logger.error('[StalledJobCheck] Error querying processing tasks:', processingErr.message);
      return NextResponse.json({ error: 'DB query failed (processing)' }, { status: 500 });
    }

    const stalledProcessing = (processingTasks ?? []).filter((t) => {
      if (t.heartbeat_at) {
        return now - new Date(t.heartbeat_at).getTime() > PROCESSING_STALL_THRESHOLD_MS;
      }
      const updated = t.updated_at ? new Date(t.updated_at).getTime() : 0;
      const created = t.created_at ? new Date(t.created_at).getTime() : 0;
      return now - Math.max(updated, created) > PROCESSING_STALL_THRESHOLD_MS;
    });

    // ── 3. Emit alerts ──────────────────────────────────────────────────────
    const totalStalled = stalledQueued.length + stalledProcessing.length;

    if (stalledQueued.length > 0) {
      logger.error(
        `[StalledJobCheck] ALERT: ${stalledQueued.length} job(s) stuck in Queued for >5 minutes — worker may be down or Redis unreachable.`,
        {
          checkedAt,
          count: stalledQueued.length,
          tasks: stalledQueued.map((t) => ({
            id: t.id,
            document_id: t.document_id,
            user_id: t.user_id,
            attempts: t.attempts,
            last_heartbeat: t.heartbeat_at,
            updated_at: t.updated_at,
            created_at: t.created_at,
            locked_by: t.locked_by,
          })),
        }
      );
    }

    if (stalledProcessing.length > 0) {
      logger.error(
        `[StalledJobCheck] ALERT: ${stalledProcessing.length} job(s) stuck in processing with stale heartbeat (>2 min) — worker may have crashed mid-job.`,
        {
          checkedAt,
          count: stalledProcessing.length,
          tasks: stalledProcessing.map((t) => ({
            id: t.id,
            document_id: t.document_id,
            user_id: t.user_id,
            attempts: t.attempts,
            last_heartbeat: t.heartbeat_at,
            updated_at: t.updated_at,
            locked_by: t.locked_by,
          })),
        }
      );
    }

    if (totalStalled === 0) {
      logger.info('[StalledJobCheck] Queue healthy — no stalled jobs found.', { checkedAt });
    }

    return NextResponse.json({
      success: true,
      checkedAt,
      stalledQueued: stalledQueued.length,
      stalledProcessing: stalledProcessing.length,
      totalStalled,
      alerted: totalStalled > 0,
      message:
        totalStalled > 0
          ? ` stalled job(s) detected — ERROR-level log lines emitted. Check Railway logs.`
          : 'Queue healthy — no stalled jobs.',
    });
  } catch (err: any) {
    logger.error('[StalledJobCheck] Unexpected error during stall check:', err?.message ?? err);
    return NextResponse.json({ error: 'Internal server error', detail: err?.message }, { status: 500 });
  }
}
