-- ============================================================
-- Migration: Phase 2B-3 – Atomic Folder Synchronization
--
-- Adds a partial unique index on public.documents to prevent
-- concurrent FolderSyncService executions from creating duplicate
-- AI-generated document link entries for the same title within
-- the same folder.
--
-- The existing folders uniqueness indexes
-- (idx_folders_unique_parent_name, idx_folders_unique_root_name, etc.)
-- already provide the required DB-level protection for folders.
-- This migration does NOT modify them.
--
-- Run ONCE in the Supabase SQL Editor.
-- ============================================================

-- Partial unique index on documents:
--   (user_id, folder_id, LOWER(title)) WHERE deleted_at IS NULL
--
-- This allows:
--   • Same title in different folders              → allowed
--   • Same title in the same folder, but soft-deleted → allowed
--   • Two active documents with the same title in the same folder → REJECTED (23505)
--
-- Concurrent INSERT attempts for the same AI-generated Summary.pdf
-- will produce a 23505 conflict that FolderSyncService handles
-- gracefully by treating the second insertion as a benign race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_folder_title
ON public.documents (user_id, folder_id, LOWER(title))
WHERE deleted_at IS NULL;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
