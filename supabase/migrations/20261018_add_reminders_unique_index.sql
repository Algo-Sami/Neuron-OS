-- ==============================================================================
-- Migration: 20261018_add_reminders_unique_index.sql
-- Subsystem: Reminders Hardening & Background Tasks Error Tracking
--
-- 1. Adds UNIQUE NULLS NOT DISTINCT constraint on reminders (user_id, title, due_date)
-- 2. Adds error_message column to public.background_tasks
-- ==============================================================================

DO $$
BEGIN
  -- 1. Deduplicate any pre-existing identical reminders (handling NULL due_date safely)
  DELETE FROM public.reminders r1
  WHERE r1.id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id, title, COALESCE(due_date, '1970-01-01'::timestamptz)
        ORDER BY created_at ASC, id ASC
      ) as rnum
      FROM public.reminders
    ) t
    WHERE t.rnum > 1
  );

  -- 2. Add unique constraint: Try NULLS NOT DISTINCT (Postgres 15+), with COALESCE index fallback
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_reminders_user_title_due'
  ) THEN
    BEGIN
      ALTER TABLE public.reminders 
        ADD CONSTRAINT uq_reminders_user_title_due UNIQUE NULLS NOT DISTINCT (user_id, title, due_date);
    EXCEPTION WHEN syntax_error OR feature_not_supported OR others THEN
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reminders_user_title_due 
        ON public.reminders (user_id, title, COALESCE(due_date, '1970-01-01'::timestamptz));
    END;
  END IF;

  -- 3. Add error_message column to background_tasks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'background_tasks' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.background_tasks ADD COLUMN error_message TEXT;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

