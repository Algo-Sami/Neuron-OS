-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add generation_version to knowledge_assets
-- Purpose  : Enables automatic AI resource versioning and stale detection.
--
-- What this does:
--   Adds a generation_version INTEGER column to the knowledge_assets table.
--   All existing rows default to version 1, which means they will be
--   automatically regenerated the first time they are requested after the
--   application is deployed with AI_GENERATION_VERSION = 2.
--
-- This migration is safe to run multiple times (IF NOT EXISTS guard).
-- No existing rows are modified — default value handles backfill.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE knowledge_assets
  ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 1;

-- Add an index to speed up version comparison queries
-- (asset lookup by document_id + asset_type already has an index; this
--  index covers the version filter that is added on top of it)
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_generation_version
  ON knowledge_assets (generation_version);

COMMENT ON COLUMN knowledge_assets.generation_version IS
  'Tracks which AI generation pipeline version produced this asset. '
  'Compared against the global AI_GENERATION_VERSION constant at request time. '
  'If stored value < current version, asset is marked outdated and regenerated automatically.';
