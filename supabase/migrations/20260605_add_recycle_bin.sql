-- ==========================================================
-- NEURON OS RECYCLE BIN DATABASE SETUP MIGRATION
-- ==========================================================
-- Paste this script into your Supabase SQL Editor to enable
-- soft-delete and the automated 10-day recycle bin cleanup
-- for both subjects and individual files (documents).

-- ----------------------------------------------------------
-- 1. Setup soft-delete column for SUBJECTS
-- ----------------------------------------------------------
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at 
ON public.subjects(deleted_at);

-- ----------------------------------------------------------
-- 2. Setup soft-delete column for DOCUMENTS
-- ----------------------------------------------------------
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at 
ON public.documents(deleted_at);

-- ----------------------------------------------------------
-- 3. Setup PostgreSQL Automatic Cleanup Cron (Runs daily at midnight)
-- ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron schedule if it exists to avoid conflicts
SELECT cron.unschedule('cleanup-recycle-bin-daily') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-recycle-bin-daily');

-- Schedule the combined cleanup cron job for both subjects and documents
SELECT cron.schedule('cleanup-recycle-bin-daily', '0 0 * * *', $$
  -- A. Delete expired recycled subject folders
  DELETE FROM public.subjects 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < now() - INTERVAL '10 days';

  -- B. Delete expired recycled files (cascade rules handle associated child data)
  -- Note: Application-level cleanup will also clean storage files for these.
  DELETE FROM public.documents 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < now() - INTERVAL '10 days';
$$);
