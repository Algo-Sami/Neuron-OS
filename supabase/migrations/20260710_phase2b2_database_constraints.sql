-- ============================================================
-- Migration: Phase 2B-2 – Database Constraint Hardening & Concurrency Protection
--
-- Adds:
-- 1. Unique constraint on public.background_tasks (user_id, document_id, task_type)
-- 2. Unique constraint on public.document_chunks (document_id, chunk_index)
-- 3. CHECK constraint on public.background_tasks.status
--
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- ── 1. Uniqueness for background_tasks ───────────────────────────────────────
-- Guarantees at most one background task per user + document + task_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_background_tasks_user_document_type'
  ) THEN
    ALTER TABLE public.background_tasks
      ADD CONSTRAINT uq_background_tasks_user_document_type
      UNIQUE (user_id, document_id, task_type);
  END IF;
END;
$$;

-- ── 2. Uniqueness for document_chunks ─────────────────────────────────────────
-- Guarantees at most one chunk per document_id + chunk_index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_document_chunks_document_index'
  ) THEN
    ALTER TABLE public.document_chunks
      ADD CONSTRAINT uq_document_chunks_document_index
      UNIQUE (document_id, chunk_index);
  END IF;
END;
$$;

-- ── 3. Status Validation CHECK Constraint for background_tasks ────────────────
-- Restricts background_tasks.status to legitimate pipeline states used in codebase
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_background_tasks_status'
  ) THEN
    ALTER TABLE public.background_tasks DROP CONSTRAINT chk_background_tasks_status;
  END IF;

  ALTER TABLE public.background_tasks
    ADD CONSTRAINT chk_background_tasks_status CHECK (
      status IN (
        'pending',
        'Queued',
        'queued',
        'processing',
        'Processing',
        'Downloading File',
        'Extracting Text',
        'Cleaning Text',
        'Validating',
        'Validating Text',
        'Saving Knowledge',
        'Saving Text',
        'Chunking Document',
        'Saving Chunks',
        'Verifying Document',
        'Generating Embeddings',
        'Verifying Knowledge',
        'Generating Summary',
        'Rendering PDF',
        'Completed',
        'completed',
        'Failed',
        'failed',
        'Cancelled',
        'cancelled'
      )
    );
END;
$$;

-- ── 4. Force PostgREST schema cache reload ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
