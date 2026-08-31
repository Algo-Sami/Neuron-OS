-- Migration: Preserve upload audit rows when files are permanently deleted
-- Instead of deleting the uploads row (which wipes history), we mark it with
-- status='deleted' and set deleted_at so the UI can display "File Deleted" entries.

-- 1. Add deleted_at column to uploads table (nullable — NULL means file is still alive)
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Index for efficient filtering of deleted uploads in the history query
CREATE INDEX IF NOT EXISTS idx_uploads_deleted_at ON public.uploads(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 3. Index for querying by status (used to find 'deleted' orphan audit rows)
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);
