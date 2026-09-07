-- ==========================================================
-- Migration: Add leaderboard_visibility to profiles
-- Authoritative server-side source of truth for leaderboard privacy
-- ==========================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_visibility BOOLEAN DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_visibility
  ON public.profiles(leaderboard_visibility);

NOTIFY pgrst, 'reload schema';
