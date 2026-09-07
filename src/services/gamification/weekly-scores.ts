import { createAdminClient } from '@/lib/supabase/admin';
import {
  QUIZ_COMPLETED_POINTS,
  STREAK_DAY_POINTS,
  MAX_DAILY_SCORED_QUIZZES,
  WeeklyScoreEvent,
} from '@/lib/gamification/scoring-rules';

/**
 * Computes the ISO Monday date string (YYYY-MM-DD) for a given date in UTC.
 * Used as the consistent weekly partitioning boundary across all timezones.
 */
export function getISOWeekStartDate(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split('T')[0];
}

/**
 * Resolves the designated point value for a specific weekly score event.
 */
function getPointsForEvent(event: WeeklyScoreEvent): number {
  switch (event) {
    case 'quiz_completed':
      return QUIZ_COMPLETED_POINTS;
    case 'streak_day':
      return STREAK_DAY_POINTS;
    default:
      return 0;
  }
}

/**
 * Server-only function that atomically increments a user's weekly leaderboard score.
 *
 * Characteristics:
 * - Stamps the user's current cohort_id from public.profiles onto public.weekly_scores.
 * - Enforces the anti-farming daily quiz cap via an atomic PostgreSQL transaction with row locks.
 * - Uses the service-role client to bypass RLS policies.
 * - Non-throwing: failures are logged, never crashing or blocking user actions or XP awards.
 */
export async function incrementWeeklyScore(
  userId: string,
  event: WeeklyScoreEvent
): Promise<{ success: boolean; credited: boolean; newScore?: number; reason?: string }> {
  try {
    const points = getPointsForEvent(event);
    if (points <= 0) {
      return { success: false, credited: false, reason: 'invalid_event_points' };
    }

    const admin = createAdminClient();
    const weekStart = getISOWeekStartDate();

    // 1. Fetch current cohort_id from profiles (authoritative source)
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('cohort_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.warn(`[WeeklyScores] Failed to lookup cohort_id for user ${userId}:`, profileErr.message);
    }

    const cohortId = profile?.cohort_id || null;

    // 2. Call atomic increment RPC in database
    const { data, error } = await admin.rpc('increment_weekly_score', {
      p_user_id: userId,
      p_cohort_id: cohortId,
      p_week_start: weekStart,
      p_points: points,
      p_event_type: event,
      p_max_daily_quizzes: MAX_DAILY_SCORED_QUIZZES,
    });

    if (error) {
      console.error(`[WeeklyScores] RPC error incrementing score for user ${userId}:`, error.message);
      return { success: false, credited: false, reason: error.message };
    }

    const res = Array.isArray(data) ? data[0] : data;
    return {
      success: true,
      credited: res?.credited ?? true,
      newScore: res?.new_score,
      reason: res?.reason,
    };
  } catch (err: any) {
    console.error(`[WeeklyScores] Unexpected failure incrementing weekly score for ${userId}:`, err?.message || err);
    return { success: false, credited: false, reason: err?.message || 'unknown_error' };
  }
}

export interface FinalizeResult {
  success: boolean;
  targetWeekStart: string;
  totalCohortsEvaluated: number;
  boostsAwarded: Array<{
    cohortId: string;
    userId: string;
    score: number;
    boostExpiresAt: string;
  }>;
  skippedCohorts: Array<{
    cohortId: string;
    reason: string;
  }>;
  error?: string;
}

/**
 * Weekly Finalization & Winner Boost Assignment.
 *
 * Runs automatically at the end of each weekly cycle:
 * - Evaluates weekly_scores for the target week partitioned by cohort_id.
 * - Picks the #1 top-scoring student per cohort using our settled deterministic tiebreaker:
 *     ORDER BY score DESC, updated_at ASC LIMIT 1
 * - Grants the winner boosts on public.profiles:
 *     boost_upload_limit = 100  (100 MB)
 *     boost_ai_limit = 50       (+50 daily requests stacking on top of baseline)
 *     boost_expires_at = now() + 7 days
 * - Overwrites existing boost expiry window cleanly (no compounding/extension on repeat wins).
 * - Only awards boosts to students who actually competed (score > 0).
 */
export async function finalizeWeeklyScoresAndApplyBoosts(
  targetWeekStart?: string
): Promise<FinalizeResult> {
  const admin = createAdminClient();
  const weekStart = targetWeekStart || getISOWeekStartDate();

  try {
    // 1. Fetch all distinct cohort_ids with recorded scores for the week
    const { data: cohortRows, error: cohortErr } = await admin
      .from('weekly_scores')
      .select('cohort_id')
      .eq('week_start', weekStart)
      .not('cohort_id', 'is', null);

    if (cohortErr) {
      console.error('[FinalizeWeeklyScores] Failed to query cohorts:', cohortErr.message);
      return {
        success: false,
        targetWeekStart: weekStart,
        totalCohortsEvaluated: 0,
        boostsAwarded: [],
        skippedCohorts: [],
        error: cohortErr.message,
      };
    }

    const cohortIds = Array.from(new Set((cohortRows || []).map((r) => r.cohort_id).filter(Boolean)));

    const boostsAwarded: FinalizeResult['boostsAwarded'] = [];
    const skippedCohorts: FinalizeResult['skippedCohorts'] = [];

    // Expiry timestamp: exactly 7 days from right now
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const boostExpiresAt = expiryDate.toISOString();

    for (const cohortId of cohortIds) {
      // Find the top-scoring participant for this cohort with deterministic tiebreaker
      const { data: topRows, error: topErr } = await admin
        .from('weekly_scores')
        .select('user_id, score, updated_at')
        .eq('cohort_id', cohortId)
        .eq('week_start', weekStart)
        .gt('score', 0) // Only award boosts to active participants who earned points
        .order('score', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(1);

      if (topErr) {
        console.warn(`[FinalizeWeeklyScores] Error finding winner for cohort ${cohortId}:`, topErr.message);
        skippedCohorts.push({ cohortId, reason: topErr.message });
        continue;
      }

      if (!topRows || topRows.length === 0) {
        skippedCohorts.push({ cohortId, reason: 'no_active_scores_above_zero' });
        continue;
      }

      const winner = topRows[0];

      // Overwrite winner's boost fields in public.profiles
      const { error: boostErr } = await admin
        .from('profiles')
        .update({
          boost_upload_limit: 100, // 100 MB
          boost_ai_limit: 50,      // +50 daily bonus requests
          boost_expires_at: boostExpiresAt,
        })
        .eq('id', winner.user_id);

      if (boostErr) {
        console.error(`[FinalizeWeeklyScores] Failed to award boost to winner ${winner.user_id}:`, boostErr.message);
        skippedCohorts.push({ cohortId, reason: boostErr.message });
      } else {
        boostsAwarded.push({
          cohortId,
          userId: winner.user_id,
          score: winner.score,
          boostExpiresAt,
        });
      }
    }

    return {
      success: true,
      targetWeekStart: weekStart,
      totalCohortsEvaluated: cohortIds.length,
      boostsAwarded,
      skippedCohorts,
    };
  } catch (err: any) {
    console.error('[FinalizeWeeklyScores] Unexpected error during weekly finalization:', err);
    return {
      success: false,
      targetWeekStart: weekStart,
      totalCohortsEvaluated: 0,
      boostsAwarded: [],
      skippedCohorts: [],
      error: err?.message || 'unknown_error',
    };
  }
}
