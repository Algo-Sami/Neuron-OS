-- ============================================================================
-- Migration: Add Note Sharing and Reporting System (Phase 6)
-- Adds opt-in raw file sharing per cohort to public.documents,
-- creates public.shared_file_reports for content reporting,
-- and adds RLS policies so cohort peers can view shared documents.
-- ============================================================================

-- 1. Sharing columns on public.documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS shared_cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_documents_shared_cohort
  ON public.documents(shared_cohort_id) WHERE is_shared = true;

-- 2. Reports table for shared content flagging
CREATE TABLE IF NOT EXISTS public.shared_file_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_shared_file_reports_document_id
  ON public.shared_file_reports(document_id);

-- 3. RLS: Cohort peer SELECT policy on documents
-- Additive alongside existing "Manage own documents" and legacy "View shared documents"
DROP POLICY IF EXISTS "Cohort peers can view shared documents" ON public.documents;
CREATE POLICY "Cohort peers can view shared documents"
  ON public.documents FOR SELECT
  USING (
    is_shared = true
    AND shared_cohort_id IS NOT NULL
    AND shared_cohort_id = (
      SELECT cohort_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. RLS on shared_file_reports
ALTER TABLE public.shared_file_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report shared files" ON public.shared_file_reports;
CREATE POLICY "Users can report shared files"
  ON public.shared_file_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their own reports" ON public.shared_file_reports;
CREATE POLICY "Users can view their own reports"
  ON public.shared_file_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

NOTIFY pgrst, 'reload schema';
