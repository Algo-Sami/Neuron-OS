-- ============================================================
-- Migration: AI Rate Limit Recovery & Persistent Cooldown State
-- Adds additive rate-limit error tracking and cooldown timestamps
-- to public.documents.
--
-- Backward-compatible: all columns are nullable with default NULL.
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ai_error_category TEXT,
  ADD COLUMN IF NOT EXISTS ai_error_code TEXT,
  ADD COLUMN IF NOT EXISTS ai_error_message TEXT,
  ADD COLUMN IF NOT EXISTS ai_cooldown_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ai_last_failed_at TIMESTAMP WITH TIME ZONE;

-- Add index on ai_cooldown_until for efficient query filtering
CREATE INDEX IF NOT EXISTS idx_documents_ai_cooldown_until
  ON public.documents (ai_cooldown_until)
  WHERE ai_cooldown_until IS NOT NULL;
