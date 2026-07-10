-- Migration: Add progress tracking and logging columns to background_tasks table
ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
