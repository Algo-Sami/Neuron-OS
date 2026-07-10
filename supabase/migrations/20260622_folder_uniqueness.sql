-- Neuron OS Folder Uniqueness Migration
-- Enforce that folder names must be unique within the same parent folder (case-insensitive, trimmed)

-- 1. Clean up any existing duplicate folders (keeping the one with the smallest id or earliest created_at)
DELETE FROM public.folders f1
USING public.folders f2
WHERE f1.id > f2.id
  AND f1.user_id = f2.user_id
  AND COALESCE(f1.subject_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(f2.subject_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND COALESCE(f1.parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(f2.parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND LOWER(TRIM(f1.name)) = LOWER(TRIM(f2.name));

-- 2. Create partial unique indexes to support case-insensitive, trimmed uniqueness of folder names
-- Under same parent_folder_id and subject_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_parent_name
ON public.folders (user_id, subject_id, parent_folder_id, LOWER(TRIM(name)))
WHERE parent_folder_id IS NOT NULL AND subject_id IS NOT NULL;

-- Under same parent_folder_id, with subject_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_parent_nosub_name
ON public.folders (user_id, parent_folder_id, LOWER(TRIM(name)))
WHERE parent_folder_id IS NOT NULL AND subject_id IS NULL;

-- Under same subject_id, with parent_folder_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_root_name
ON public.folders (user_id, subject_id, LOWER(TRIM(name)))
WHERE parent_folder_id IS NULL AND subject_id IS NOT NULL;

-- Under same user, both parent_folder_id and subject_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_root_nosub_name
ON public.folders (user_id, LOWER(TRIM(name)))
WHERE parent_folder_id IS NULL AND subject_id IS NULL;
