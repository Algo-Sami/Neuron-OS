-- ============================================================
-- Migration: Phase 8 – Knowledge Assets Layer
-- Creates the permanent storage architecture for all AI-generated
-- educational resources in Neuron OS.
--
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- ── 1. knowledge_assets ──────────────────────────────────────────────────────
-- The primary asset store. Every AI-generated educational resource
-- is registered here as a "Knowledge Asset" linked to a lecture.

CREATE TABLE IF NOT EXISTS public.knowledge_assets (
  -- Identity
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES public.profiles(id)  ON DELETE CASCADE NOT NULL,
  document_id         UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,

  -- Asset classification
  asset_type          TEXT NOT NULL,
  -- Supported: summary | key_points | definitions | examples |
  --            flashcards | quiz | study_guide | revision_notes
  -- Future:    mind_map | cheat_sheet | formula_sheet | exam_pack | concept_map

  mode                TEXT,
  -- Mode variant, e.g. 'detailed', 'concise', 'beginner' for summaries.
  -- NULL for asset types that don't have modes.

  -- Lifecycle status
  status              TEXT NOT NULL DEFAULT 'requested',
  -- requested | generating | validating | stored | ready | failed | archived

  -- Content (type-specific structure stored as JSONB)
  content             JSONB,
  -- For summary:    { "summaryText": "...", "keyPoints": ["..."] }
  -- For flashcards: [{ "front": "...", "back": "..." }]
  -- For quiz:       [{ "question": "...", "options": [], "correctAnswer": 0, "explanation": "..." }]
  -- For key_points: ["point1", "point2", ...]
  -- For definitions:[{ "term": "...", "definition": "..." }]

  -- AI provenance metadata
  ai_skill            TEXT,        -- e.g. 'SummarizeLecture', 'GenerateFlashcards'
  ai_model            TEXT,        -- e.g. 'gemini-1.5-flash', 'gemini-1.5-pro'
  prompt_version      TEXT DEFAULT '1.0', -- Prompt registry version for reproducibility

  -- Knowledge version: increments when the document's embeddings are regenerated.
  -- Allows detection of stale assets that should be refreshed.
  knowledge_version   INTEGER DEFAULT 1,

  -- Asset version: starts at 1, increments on each forced regeneration.
  -- Historical versions are archived in knowledge_asset_versions.
  version             INTEGER DEFAULT 1,

  -- Validation outcome
  validation_passed   BOOLEAN,
  validation_errors   TEXT[],      -- List of failed validation rule names

  -- Retrieval metadata (for observability and debugging)
  retrieval_chunks    INTEGER DEFAULT 0,
  confidence_score    NUMERIC(4,3) DEFAULT 0.000,
  confidence_label    TEXT,
  sources_used        TEXT[],

  -- Error tracking
  error_message       TEXT,
  error_stage         TEXT,        -- Which lifecycle stage failed

  -- Timestamps
  generated_at        TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- ── Idempotency constraint ──────────────────────────────────────────────────
  -- Prevents duplicate assets for the same lecture + type + mode.
  -- Mode is part of the key to allow multiple modes of the same type (e.g.,
  -- a 'detailed' summary and a 'concise' summary can coexist for one lecture).
  CONSTRAINT uq_knowledge_asset UNIQUE (document_id, asset_type, mode),

  -- ── Type guard ─────────────────────────────────────────────────────────────
  CONSTRAINT chk_asset_type CHECK (asset_type IN (
    'summary', 'key_points', 'definitions', 'examples',
    'flashcards', 'quiz', 'study_guide', 'revision_notes',
    -- Future asset types (pre-registered for zero schema changes):
    'mind_map', 'cheat_sheet', 'formula_sheet', 'exam_pack', 'concept_map'
  )),

  CONSTRAINT chk_asset_status CHECK (status IN (
    'requested', 'generating', 'validating', 'stored', 'ready', 'failed', 'archived'
  ))
);

-- ── 2. knowledge_asset_versions ───────────────────────────────────────────────
-- Immutable version history. When an asset is regenerated, the previous
-- content is archived here before the parent row is updated.

CREATE TABLE IF NOT EXISTS public.knowledge_asset_versions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id        UUID REFERENCES public.knowledge_assets(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  document_id     UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  version         INTEGER NOT NULL,       -- The version number being archived
  asset_type      TEXT NOT NULL,
  mode            TEXT,
  content         JSONB,                  -- Snapshot of the content at this version
  ai_skill        TEXT,
  ai_model        TEXT,
  prompt_version  TEXT,
  confidence_score NUMERIC(4,3),
  archived_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_document
  ON public.knowledge_assets (document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_user
  ON public.knowledge_assets (user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_type
  ON public.knowledge_assets (asset_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_status
  ON public.knowledge_assets (status);

-- Composite index for the most common query: "all assets for this lecture, owned by this user"
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_user_document
  ON public.knowledge_assets (user_id, document_id);

-- Version history lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_asset_versions_asset
  ON public.knowledge_asset_versions (asset_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_asset_versions_user
  ON public.knowledge_asset_versions (user_id);

-- ── 4. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.knowledge_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_asset_versions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own Knowledge Assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'knowledge_assets'
      AND policyname = 'Users can manage their own knowledge assets'
  ) THEN
    CREATE POLICY "Users can manage their own knowledge assets"
      ON public.knowledge_assets
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

-- Users can only read their own version history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'knowledge_asset_versions'
      AND policyname = 'Users can manage their own knowledge asset versions'
  ) THEN
    CREATE POLICY "Users can manage their own knowledge asset versions"
      ON public.knowledge_asset_versions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

-- ── 5. updated_at auto-trigger ────────────────────────────────────────────────

-- Reuse or create the trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_assets_updated_at ON public.knowledge_assets;
CREATE TRIGGER trg_knowledge_assets_updated_at
  BEFORE UPDATE ON public.knowledge_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 6. Force PostgREST schema cache reload ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
