-- ============================================================
-- Migration: Phase 2 – Embedding Status Tracking
-- Adds embedding lifecycle columns to document_knowledge.
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- Add embedding tracking columns to document_knowledge
ALTER TABLE public.document_knowledge
  ADD COLUMN IF NOT EXISTS embedding_status        TEXT DEFAULT 'pending',
  -- pending | generating | completed | failed
  ADD COLUMN IF NOT EXISTS embedding_count         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embeddings_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS embedding_error_message TEXT;

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_document_knowledge_embedding_status
  ON public.document_knowledge (embedding_status);

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
