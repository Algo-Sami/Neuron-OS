-- Migration: Persist Subject and Folder snapshot metadata in uploads audit table
-- Ensures deleted files forever retain their originating subject name, subject ID,
-- folder name, and folder ID in the Upload History.

-- 1. Add subject and folder snapshot columns to uploads table
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_name TEXT,
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folder_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_subject TEXT,
  ADD COLUMN IF NOT EXISTS ai_topic TEXT;

-- 2. Indexes for efficient filtering and subject querying
CREATE INDEX IF NOT EXISTS idx_uploads_subject_id ON public.uploads(subject_id);
CREATE INDEX IF NOT EXISTS idx_uploads_folder_id ON public.uploads(folder_id);

-- 3. Backfill active and historical uploads from documents, subjects, and folders
UPDATE public.uploads u
SET 
  subject_id = COALESCE(u.subject_id, d.subject_id),
  subject_name = COALESCE(u.subject_name, s.name, d.ai_subject),
  folder_id = COALESCE(u.folder_id, d.folder_id),
  folder_name = COALESCE(u.folder_name, f.name, d.ai_topic),
  ai_subject = COALESCE(u.ai_subject, s.name, d.ai_subject),
  ai_topic = COALESCE(u.ai_topic, f.name, d.ai_topic)
FROM public.documents d
LEFT JOIN public.subjects s ON s.id = d.subject_id
LEFT JOIN public.folders f ON f.id = d.folder_id
WHERE d.upload_id = u.id;

-- 4. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
