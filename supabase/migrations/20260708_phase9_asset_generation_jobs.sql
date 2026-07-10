-- ============================================================
-- Migration: Phase 9 – AI Asset Generation Jobs Tracking
-- Creates the tracking table for active and queued generation jobs,
-- preventing duplicate concurrent work and managing dependencies.
--
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- Alter knowledge_assets check constraint to allow 'outdated' and 'regenerating'
ALTER TABLE public.knowledge_assets DROP CONSTRAINT IF EXISTS chk_asset_status;
ALTER TABLE public.knowledge_assets ADD CONSTRAINT chk_asset_status CHECK (status IN (
  'requested', 'generating', 'validating', 'stored', 'ready', 'failed', 'archived', 'outdated', 'regenerating'
));

-- ── 1. asset_generation_jobs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_generation_jobs (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_id         UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  
  -- The target asset details
  asset_type          TEXT NOT NULL,
  mode                TEXT, -- Optional mode parameter for the asset (e.g. 'detailed')
  
  -- Lifecycle status
  status              TEXT NOT NULL DEFAULT 'queued',
  -- queued | running | completed | failed | cancelled | skipped
  
  -- Dependency and Execution details
  priority            INTEGER DEFAULT 10,
  depends_on_types    TEXT[] DEFAULT '{}'::text[], -- List of asset_types this job waits on
  
  -- Tracking details
  request_id          TEXT,
  error_message       TEXT,
  knowledge_version   INTEGER DEFAULT 1,
  
  -- Timestamps
  queued_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at          TIMESTAMP WITH TIME ZONE,
  completed_at        TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Enforce status values
  CONSTRAINT chk_job_status CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'cancelled', 'skipped'
  ))
);

-- Partial Unique Index to enforce idempotency on ACTIVE jobs.
-- This guarantees that for a given document, asset_type, and mode combination,
-- there can never be more than one job in progress ('queued' or 'running') at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_generation_job
  ON public.asset_generation_jobs(document_id, asset_type, COALESCE(mode, ''))
  WHERE status IN ('queued', 'running');

-- ── 2. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asset_generation_jobs_user_document
  ON public.asset_generation_jobs (user_id, document_id);

CREATE INDEX IF NOT EXISTS idx_asset_generation_jobs_status
  ON public.asset_generation_jobs (status);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.asset_generation_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'asset_generation_jobs'
      AND policyname = 'Users can manage their own generation jobs'
  ) THEN
    CREATE POLICY "Users can manage their own generation jobs"
      ON public.asset_generation_jobs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

-- ── 4. Trigger for updated_at ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_asset_generation_jobs_updated_at ON public.asset_generation_jobs;
CREATE TRIGGER trg_asset_generation_jobs_updated_at
  BEFORE UPDATE ON public.asset_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. Force PostgREST schema cache reload ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
