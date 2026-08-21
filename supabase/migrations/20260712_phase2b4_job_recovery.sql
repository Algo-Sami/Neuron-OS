-- ============================================================
-- Migration: Phase 2B-4 – Background Job Crash Recovery & Stale-Job Detection
--
-- Adds lease, heartbeat, and attempt tracking fields to:
-- 1. public.background_tasks
-- 2. public.asset_generation_jobs
--
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- ── 1. background_tasks lease and retry columns ─────────────────────────────
ALTER TABLE public.background_tasks
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for fast discovery of active and stale tasks
CREATE INDEX IF NOT EXISTS idx_background_tasks_recovery
  ON public.background_tasks (status, lock_expires_at);

-- ── 2. asset_generation_jobs lease columns ─────────────────────────────────
ALTER TABLE public.asset_generation_jobs
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

-- Index for stale asset generation job recovery
CREATE INDEX IF NOT EXISTS idx_asset_generation_jobs_recovery
  ON public.asset_generation_jobs (status, lock_expires_at);

-- ── 3. Force PostgREST schema cache reload ──────────────────────────────────
NOTIFY pgrst, 'reload schema';
