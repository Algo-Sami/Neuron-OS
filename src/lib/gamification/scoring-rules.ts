/**
 * Weekly Leaderboard Scoring Rules & Constants (Phase 3)
 *
 * Defines the point values awarded to public.weekly_scores for competitive
 * cohort rankings. These point values are completely independent of lifetime XP.
 */

export const QUIZ_COMPLETED_POINTS    = 50;  // per quiz completion
export const STREAK_DAY_POINTS        = 10;  // per daily check-in (once per calendar day)

/**
 * Maximum number of quiz completions that count towards weekly leaderboard points
 * per user per calendar day (UTC). Any quiz completed beyond this cap still awards
 * standard lifetime XP, but contributes 0 weekly score points (anti-farming protection).
 */
export const MAX_DAILY_SCORED_QUIZZES = 5;

export type WeeklyScoreEvent =
  | 'quiz_completed'
  | 'streak_day';
