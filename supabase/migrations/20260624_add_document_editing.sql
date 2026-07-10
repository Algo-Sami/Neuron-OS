-- Alter table documents to support inline file editing
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 0;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
