import { NextRequest, NextResponse } from 'next/server';
import { 
  getISOWeekStartDate,
  finalizeWeeklyScoresAndApplyBoosts 
} from '@/services/gamification/weekly-scores';

/**
 * Scheduled Cron Handler for Weekly Scores & Winner Boost Assignment.
 *
 * Runs automatically every Sunday at 23:55 UTC (or Monday 00:05 UTC) via Vercel Cron or external scheduler.
 * Authenticated via Authorization: Bearer <CRON_SECRET>.
 *
 * Identifies the top-scoring participant for each cohort, grants 7-day boosts, and snapshots results.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional query param to override target week for testing/manual triggering
  const url = new URL(req.url);
  const requestedWeek = url.searchParams.get('week') || undefined;

  const result = await finalizeWeeklyScoresAndApplyBoosts(requestedWeek);

  return NextResponse.json({
    success: result.success,
    message: result.success ? 'Weekly scores finalized and boosts applied successfully.' : result.error,
    data: result,
    timestamp: new Date().toISOString(),
  });
}
