-- ==========================================================
-- Migration: Add Winner Boosts and Dedicated Tier Flag
-- Phase 5: Weekly Reset & Winner Boost System
-- ==========================================================

-- 1. Add tier flag and boost fields to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS boost_upload_limit INT NULL,
  ADD COLUMN IF NOT EXISTS boost_ai_limit INT NULL,
  ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ NULL;

-- 2. Add index on boost_expires_at for fast expiration queries
CREATE INDEX IF NOT EXISTS idx_profiles_boost_expires_at
  ON public.profiles(boost_expires_at);

NOTIFY pgrst, 'reload schema';
