-- ==============================================================================
-- Migration: 20261020_create_public_profiles_view.sql
-- Subsystem: Profiles & Documents Security Hardening (Phase 7 - Part B: Step 1)
--
-- Objective:
-- 1. Create secure `public_profiles` view with safe columns and row-level filtering:
--    - Your own profile (auth.uid() = id)
--    - Same academic cohort peers (cohort_id match)
--    - Shared study room members (room_members overlap)
--    - Visible on leaderboard (leaderboard_visibility = true)
-- 2. Strictly exclude sensitive PII (email is owner-only, never in public view).
-- 3. Exclude server-managed privilege columns (is_premium, boost_*).
-- 4. Enable security_barrier = true.
-- 5. Revoke access from anon and public; grant SELECT only to authenticated.
-- 6. Add performance indexes for cohort and room membership filtering.
-- ==============================================================================

-- ── 1. Create Performance Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_cohort_id 
  ON public.profiles(cohort_id);

CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_vis 
  ON public.profiles(leaderboard_visibility) 
  WHERE leaderboard_visibility = true;

CREATE INDEX IF NOT EXISTS idx_room_members_user_room 
  ON public.room_members(user_id, room_id);

CREATE INDEX IF NOT EXISTS idx_room_members_room_user 
  ON public.room_members(room_id, user_id);

-- ── 2. Create public_profiles View ────────────────────────────────────────────
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.full_name,
  p.username,
  p.avatar_url,
  p.profile_image,
  p.university,
  p.major,
  p.degree_program,
  p.semester,
  p.university_id,
  p.program_id,
  p.cohort_id,
  p.leaderboard_visibility,
  p.created_at
FROM public.profiles p
WHERE
  -- 1. Own profile
  p.id = auth.uid()
  -- 2. Leaderboard visible
  OR p.leaderboard_visibility = true
  -- 3. Same cohort peers
  OR (
    p.cohort_id IS NOT NULL 
    AND p.cohort_id = (SELECT cohort_id FROM public.profiles WHERE id = auth.uid())
  )
  -- 4. Shared study-room peers
  OR EXISTS (
    SELECT 1 
    FROM public.room_members rm_me
    JOIN public.room_members rm_peer ON rm_me.room_id = rm_peer.room_id
    WHERE rm_me.user_id = auth.uid() 
      AND rm_peer.user_id = p.id
  );

-- ── 3. Explicit Grants & Revocations ──────────────────────────────────────────
REVOKE ALL ON public.public_profiles FROM public, anon;
GRANT SELECT ON public.public_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
