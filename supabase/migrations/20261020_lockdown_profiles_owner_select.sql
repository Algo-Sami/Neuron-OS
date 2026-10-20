-- ==============================================================================
-- Migration: 20261020_lockdown_profiles_owner_select.sql
-- Subsystem: Profiles & Documents Security Hardening (Phase 7 - Part B: Step 2)
--
-- Objective:
-- 1. Restrict SELECT on public.profiles to owner-only (auth.uid() = id).
--    All cross-user reads (leaderboards, rooms, class notes) MUST use public_profiles.
-- 2. Closes the email and sensitive PII scrape vulnerability completely.
-- ==============================================================================

-- Ensure RLS is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who created them" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create strict owner-only SELECT policy
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

NOTIFY pgrst, 'reload schema';
