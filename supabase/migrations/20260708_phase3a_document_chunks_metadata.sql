-- Migration: Add metadata and subject_id to document_chunks
-- Phase 3A: Integrate Document Chunking

ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Enable indexing on metadata and subject_id for query performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata ON public.document_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_document_chunks_subject_id ON public.document_chunks (subject_id);

-- Force PostgREST to reload schema cache to recognize the new columns immediately
NOTIFY pgrst, 'reload schema';
