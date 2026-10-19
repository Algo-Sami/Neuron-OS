-- ==============================================================================
-- Migration: 20261017_fix_gamification_privacy_and_constraints.sql
-- Subsystem: Security / Privacy / Constraints Hardening
--
-- 1. Restricts SELECT on user_progress, user_achievements, and profiles
--    to authenticated users only (prevents anonymous scraping via anon key).
-- 2. Adds UNIQUE constraint on achievements.name (prevents duplicate catalog rows).
-- ==============================================================================

-- ── 1. ACHIEVEMENTS UNIQUE CONSTRAINT ─────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_achievements_name'
  ) THEN
    ALTER TABLE public.achievements ADD CONSTRAINT uq_achievements_name UNIQUE (name);
  END IF;
END $$;

-- ── 2. RESTRICT USER_PROGRESS TO AUTHENTICATED USERS ─────────────────────────

DROP POLICY IF EXISTS "Anyone can view user progress" ON public.user_progress;
DROP POLICY IF EXISTS "Authenticated users can view user progress" ON public.user_progress;

CREATE POLICY "Authenticated users can view user progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING (true);

-- ── 3. RESTRICT USER_ACHIEVEMENTS TO AUTHENTICATED USERS ───────────────────────

DROP POLICY IF EXISTS "Anyone can view user achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Authenticated users can view user achievements" ON public.user_achievements;

CREATE POLICY "Authenticated users can view user achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (true);

-- ── 4. RESTRICT PROFILES TO AUTHENTICATED USERS ───────────────────────────────

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
