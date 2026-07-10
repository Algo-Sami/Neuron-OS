-- ============================================================
-- Migration: Phase 2.1 – Background Tasks Full Setup
-- Run this ONCE in Supabase SQL Editor to fix schema cache issues
-- ============================================================

-- Step 1: Ensure the background_tasks table exists
CREATE TABLE IF NOT EXISTS public.background_tasks (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id)   ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id)  ON DELETE CASCADE NOT NULL,
  task_type   TEXT NOT NULL,
  status      TEXT DEFAULT 'pending' NOT NULL,        -- pending | processing | completed | failed
  progress    JSONB DEFAULT '{}'::jsonb,              -- per-stage progress tracking
  logs        JSONB DEFAULT '[]'::jsonb,              -- diagnostic log entries
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Add progress/logs columns if they were not added by earlier migration
ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS logs    JSONB DEFAULT '[]'::jsonb;

-- Step 3: Enable RLS if not already enabled
ALTER TABLE public.background_tasks ENABLE ROW LEVEL SECURITY;

-- Step 4: Create access policy if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'background_tasks'
      AND policyname = 'Users can manage their own background tasks'
  ) THEN
    CREATE POLICY "Users can manage their own background tasks"
      ON public.background_tasks
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- Step 5: Force PostgREST to reload its schema cache
-- This resolves "Could not find the table 'public.background_tasks' in the schema cache"
NOTIFY pgrst, 'reload schema';
