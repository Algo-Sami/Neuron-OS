-- ==========================================================
-- Migration: Add Weekly Scores System (Phase 3)
-- Independent weekly competitive leaderboard tracking per cohort
-- ==========================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.weekly_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id           UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  week_start          DATE NOT NULL,
  score               INT NOT NULL DEFAULT 0,
  daily_quiz_counts   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_weekly_scores_user_week UNIQUE (user_id, week_start)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_weekly_scores_user_id ON public.weekly_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_cohort_id ON public.weekly_scores(cohort_id);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_week_start ON public.weekly_scores(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_cohort_week ON public.weekly_scores(cohort_id, week_start, score DESC);

-- 3. Row Level Security
ALTER TABLE public.weekly_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weekly score" ON public.weekly_scores;
CREATE POLICY "Users can view own weekly score"
  ON public.weekly_scores FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view cohort weekly scores" ON public.weekly_scores;
CREATE POLICY "Users can view cohort weekly scores"
  ON public.weekly_scores FOR SELECT
  USING (
    cohort_id IS NOT NULL AND
    cohort_id = (SELECT cohort_id FROM public.profiles WHERE id = auth.uid())
  );

-- No client INSERT/UPDATE/DELETE policies (service-role write path only).

-- 4. Atomic upsert function with FOR UPDATE row-locking anti-farming protection
CREATE OR REPLACE FUNCTION public.increment_weekly_score(
  p_user_id UUID,
  p_cohort_id UUID,
  p_week_start DATE,
  p_points INT,
  p_event_type TEXT,
  p_max_daily_quizzes INT DEFAULT 5
)
RETURNS TABLE (
  new_score INT,
  credited BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today TEXT := to_char(timezone('utc', now()), 'YYYY-MM-DD');
  v_current_quiz_count INT := 0;
  v_existing_counts JSONB;
BEGIN
  -- If event is quiz_completed, enforce strict anti-farming cap with row lock
  IF p_event_type = 'quiz_completed' THEN
    -- FOR UPDATE acquires an exclusive row lock if row exists,
    -- preventing concurrent calls from slipping past the cap.
    SELECT ws.daily_quiz_counts INTO v_existing_counts
    FROM public.weekly_scores ws
    WHERE ws.user_id = p_user_id AND ws.week_start = p_week_start
    FOR UPDATE;

    IF v_existing_counts IS NOT NULL AND v_existing_counts ? v_today THEN
      v_current_quiz_count := (v_existing_counts->>v_today)::INT;
    END IF;

    IF v_current_quiz_count >= p_max_daily_quizzes THEN
      RETURN QUERY
      SELECT ws.score, FALSE, 'daily_quiz_cap_reached'::TEXT
      FROM public.weekly_scores ws
      WHERE ws.user_id = p_user_id AND ws.week_start = p_week_start;
      RETURN;
    END IF;
  END IF;

  -- Atomic INSERT ... ON CONFLICT DO UPDATE
  RETURN QUERY
  INSERT INTO public.weekly_scores (
    user_id,
    cohort_id,
    week_start,
    score,
    daily_quiz_counts,
    updated_at
  )
  VALUES (
    p_user_id,
    p_cohort_id,
    p_week_start,
    p_points,
    CASE 
      WHEN p_event_type = 'quiz_completed' THEN jsonb_build_object(v_today, 1)
      ELSE '{}'::jsonb
    END,
    timezone('utc', now())
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    score = weekly_scores.score + EXCLUDED.score,
    cohort_id = COALESCE(EXCLUDED.cohort_id, weekly_scores.cohort_id),
    daily_quiz_counts = CASE
      WHEN p_event_type = 'quiz_completed' THEN
        jsonb_set(
          COALESCE(weekly_scores.daily_quiz_counts, '{}'::jsonb),
          ARRAY[v_today],
          to_jsonb(COALESCE((weekly_scores.daily_quiz_counts->>v_today)::INT, 0) + 1)
        )
      ELSE weekly_scores.daily_quiz_counts
    END,
    updated_at = timezone('utc', now())
  RETURNING weekly_scores.score, TRUE, 'points_credited'::TEXT;
END;
$$;

NOTIFY pgrst, 'reload schema';
