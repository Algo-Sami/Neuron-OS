-- ============================================================
-- Migration: Phase 2 – Reliable Document Knowledge Layer
-- Run this ONCE in the Supabase SQL Editor.
-- ============================================================

-- 1. Create the permanent document_knowledge table
-- This is the single source of truth for extracted document text.
-- Future AI features must read from this table, not from the original PDF.
CREATE TABLE IF NOT EXISTS public.document_knowledge (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_id             UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  subject_id              UUID REFERENCES public.subjects(id) ON DELETE SET NULL,

  -- File metadata
  original_filename       TEXT,
  upload_timestamp        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

  -- Pipeline status tracking
  current_processing_stage TEXT DEFAULT 'Queued',
  -- Possible stages: Queued | Downloading File | Extracting Text | Cleaning Text | Validating | Saving Knowledge | Generating Metadata | Completed | Failed
  
  extraction_status       TEXT DEFAULT 'pending',    -- pending | success | failed
  validation_status       TEXT DEFAULT 'pending',    -- pending | passed | failed
  storage_status          TEXT DEFAULT 'pending',    -- pending | stored | failed
  
  -- Extraction metrics
  extraction_engine       TEXT,                       -- e.g. pdf-parse, pdfjs-dist, Gemini OCR, Mammoth, etc.
  character_count         INTEGER DEFAULT 0,
  word_count              INTEGER DEFAULT 0,
  estimated_reading_time  INTEGER DEFAULT 0,          -- in minutes
  heading_count           INTEGER DEFAULT 0,
  paragraph_count         INTEGER DEFAULT 0,
  
  -- Processing metadata
  processing_duration     INTEGER DEFAULT 0,          -- in milliseconds
  retry_count             INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message           TEXT,
  validation_failure_reason TEXT,
  
  -- The cleaned, validated text (THE KNOWLEDGE SOURCE)
  cleaned_text            TEXT,
  
  -- Rich metadata for AI use
  metadata                JSONB DEFAULT '{}'::jsonb,
  -- Contains: { title, subject, lectureNumber, language, lastProcessedAt, extractionMethodUsed, validationResult }
  
  -- Full processing log entries
  logs                    JSONB DEFAULT '[]'::jsonb,
  -- Array of: { timestamp, stage, message, level }
  
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one record per document (idempotency guarantee)
  UNIQUE(document_id)
);

-- 2. Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_document_knowledge_document ON public.document_knowledge(document_id);
CREATE INDEX IF NOT EXISTS idx_document_knowledge_user ON public.document_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_document_knowledge_subject ON public.document_knowledge(subject_id);
CREATE INDEX IF NOT EXISTS idx_document_knowledge_status ON public.document_knowledge(extraction_status, validation_status);

-- 3. Enable Row Level Security
ALTER TABLE public.document_knowledge ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Users can only access their own knowledge records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_knowledge'
      AND policyname = 'Users can manage their own document knowledge'
  ) THEN
    CREATE POLICY "Users can manage their own document knowledge"
      ON public.document_knowledge
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

-- 5. Add content column to documents table if not already present
-- This column stores cleaned text for fast retrieval without joining document_knowledge
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content TEXT;

-- 6. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
