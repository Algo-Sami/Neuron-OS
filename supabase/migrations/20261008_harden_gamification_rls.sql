-- ==============================================================================
-- Migration: 20261008_harden_gamification_rls.sql
-- Subsystem: Security / Gamification (Problems 16 & Extended Gamification Audit)
-- 
-- 1. Hardens achievements catalog RLS:
--    - Ensures achievements is read-only for public/authenticated clients.
--    - Drops any open INSERT/UPDATE/DELETE policies.
--    - Seeds standard catalog with ON CONFLICT (name) DO NOTHING.
-- 
-- 2. Hardens user_achievements RLS:
--    - Drops permissive "Manage own user_achievements" policy.
--    - Restricts client access to SELECT only (publicly visible for leaderboards & profiles).
--    - Disallows client INSERT/UPDATE/DELETE (achievement awards happen exclusively via server-role).
-- 
-- 3. Hardens user_progress RLS:
--    - Drops permissive "Users can update own user_progress" policy.
--    - Drops client INSERT and DELETE policies.
--    - Preserves SELECT (read-only for leaderboard and profile displays).
--    - XP and streaks are strictly mutated via server-role (awardXP).
-- ==============================================================================

-- ── 1. ACHIEVEMENTS CATALOG ───────────────────────────────────────────────────

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Anyone can update achievements" ON public.achievements;
DROP POLICY IF EXISTS "Anyone can delete achievements" ON public.achievements;
DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;

CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  USING (true);

-- Seed default achievements catalog declaratively
INSERT INTO public.achievements (id, name, description, icon_url, xp_reward)
VALUES 
  ('f1a8e2b3-7c9d-4e0f-8a1b-2c3d4e5f6a7b', 'First of Many', 'Upload your first study document.', 'FileText', 150),
  ('b2c9d4e5-8f0a-1b2c-3d4e-5f6a7b8c9d0e', 'Knowledge Collector', 'Upload 5 study documents to your library.', 'BookOpen', 300),
  ('c3d4e5f6-9a0b-1c2d-3e4f-5a6b7c8d9e0f', 'Quiz Whiz', 'Complete your first dynamic study quiz.', 'Zap', 200),
  ('d4e5f6a7-0b1c-2d3e-4f5a-6b7c8d9e0f1a', 'Perfect Score', 'Answer all questions correctly in a quiz.', 'Award', 350),
  ('e5f6a7b8-1c2d-3e4f-5a6b-7c8d9e0f1a2b', 'Collaborator', 'Share study materials with your classmates.', 'Share2', 150),
  ('f6a7b8c9-2d3e-4f5a-6b7c-8d9e0f1a2b3c', 'Focus Initiate', 'Complete your first deep focus study session.', 'Clock', 200),
  ('a7b8c9d0-3e4f-5a6b-7c8d-9e0f1a2b3c4d', 'Daily Streak Starter', 'Perform daily actions 3 days in a row.', 'Flame', 250),
  ('b8c9d0e1-4f5a-6b7c-8d9e-0f1a2b3c4d5e', 'Neuron Scholar', 'Reach Level 5 and prove your academic commitment.', 'Sparkles', 500)
ON CONFLICT (id) DO NOTHING;

-- ── 2. USER_ACHIEVEMENTS (MAPPING) ───────────────────────────────────────────

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can insert own user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can update own user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can delete own user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Anyone can view user achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can view own user achievements" ON public.user_achievements;

-- Read-only policy: badges are public so students can see badges on leaderboards and user profiles
CREATE POLICY "Anyone can view user achievements"
  ON public.user_achievements FOR SELECT
  USING (true);

-- No client INSERT/UPDATE/DELETE policies (service-role write path only).

-- ── 3. USER_PROGRESS (XP & STREAKS) ──────────────────────────────────────────

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own user_progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own user_progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own user_progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can delete own user_progress" ON public.user_progress;
DROP POLICY IF EXISTS "Anyone can view user progress" ON public.user_progress;

-- Read-only policy: anyone can view XP / levels for global rankings and stats
CREATE POLICY "Anyone can view user progress"
  ON public.user_progress FOR SELECT
  USING (true);

-- No client INSERT/UPDATE/DELETE policies (service-role write path only).

NOTIFY pgrst, 'reload schema';
