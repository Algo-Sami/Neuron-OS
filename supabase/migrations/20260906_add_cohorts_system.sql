-- Migration: Add cohorts system and automatic profile cohort resolution
-- Phase 2: Cohort Derivation System

-- 1. Create public.cohorts table
CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.degree_programs(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_cohorts_uni_prog_sem UNIQUE (university_id, program_id, semester)
);

-- Explicit indexes on foreign keys and compound lookup columns
CREATE INDEX IF NOT EXISTS idx_cohorts_university_id 
  ON public.cohorts (university_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_program_id 
  ON public.cohorts (program_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_uni_prog_sem 
  ON public.cohorts (university_id, program_id, semester);

-- 2. Add semester and cohort_id to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_cohort_id 
  ON public.profiles (cohort_id);

-- 3. Trigger function to resolve and assign stable cohort_id automatically
-- Hardened with SECURITY DEFINER and explicit search_path = public
CREATE OR REPLACE FUNCTION public.get_or_create_cohort()
RETURNS trigger AS $$
DECLARE
  v_cohort_id UUID;
BEGIN
  -- If any defining attribute is missing or blank, clear cohort_id
  IF NEW.university_id IS NULL OR NEW.program_id IS NULL OR NEW.semester IS NULL OR trim(NEW.semester) = '' THEN
    NEW.cohort_id := NULL;
    RETURN NEW;
  END IF;

  -- Trim semester whitespace
  NEW.semester := trim(NEW.semester);

  -- Concurrency-safe insert: ON CONFLICT DO NOTHING handles race conditions
  INSERT INTO public.cohorts (university_id, program_id, semester)
  VALUES (NEW.university_id, NEW.program_id, NEW.semester)
  ON CONFLICT (university_id, program_id, semester) DO NOTHING;

  -- Retrieve the stable cohort ID
  SELECT id INTO v_cohort_id
  FROM public.cohorts
  WHERE university_id = NEW.university_id
    AND program_id = NEW.program_id
    AND semester = NEW.semester;

  NEW.cohort_id := v_cohort_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if previously created, then bind
DROP TRIGGER IF EXISTS trigger_profile_cohort ON public.profiles;
CREATE TRIGGER trigger_profile_cohort
  BEFORE INSERT OR UPDATE OF university_id, program_id, semester
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.get_or_create_cohort();

-- 4. One-time data backfill: Re-fire trigger for all existing profiles with valid attributes
UPDATE public.profiles
SET semester = trim(semester)
WHERE university_id IS NOT NULL
  AND program_id IS NOT NULL
  AND semester IS NOT NULL
  AND trim(semester) <> '';

-- 5. Row Level Security (RLS) on public.cohorts
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

-- Read policy restricted strictly to authenticated users (no anonymous access)
DROP POLICY IF EXISTS "Allow authenticated users to view cohorts" ON public.cohorts;
CREATE POLICY "Allow authenticated users to view cohorts" 
  ON public.cohorts FOR SELECT 
  TO authenticated 
  USING (true);

-- 6. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
