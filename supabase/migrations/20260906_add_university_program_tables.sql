-- Migration: Add universities, degree_programs, and university_requests reference tables
-- Phase 1 of University & Degree Program standardization

-- 1. Create public.universities table
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Case-insensitive uniqueness on university name
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_name_lower 
  ON public.universities (lower(name));

-- 2. Create public.degree_programs table
CREATE TABLE IF NOT EXISTS public.degree_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Case-insensitive uniqueness on program name per university
CREATE UNIQUE INDEX IF NOT EXISTS idx_degree_programs_uni_name_lower 
  ON public.degree_programs (university_id, lower(name));

-- Explicit index on foreign key for performance
CREATE INDEX IF NOT EXISTS idx_degree_programs_university_id 
  ON public.degree_programs (university_id);

-- 3. Create public.university_requests table (with length caps to prevent spam/abuse)
CREATE TABLE IF NOT EXISTS public.university_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  note VARCHAR(1000),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Add nullable foreign key columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.degree_programs(id) ON DELETE SET NULL;

-- Explicit indexes on profiles FK columns
CREATE INDEX IF NOT EXISTS idx_profiles_university_id 
  ON public.profiles (university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_program_id 
  ON public.profiles (program_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degree_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_requests ENABLE ROW LEVEL SECURITY;

-- Allow both anonymous and authenticated users to read public catalog reference data
DROP POLICY IF EXISTS "Allow authenticated users to view universities" ON public.universities;
DROP POLICY IF EXISTS "Allow public read of universities" ON public.universities;
CREATE POLICY "Allow public read of universities" 
  ON public.universities FOR SELECT 
  TO anon, authenticated 
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to view degree programs" ON public.degree_programs;
DROP POLICY IF EXISTS "Allow public read of degree programs" ON public.degree_programs;
CREATE POLICY "Allow public read of degree programs" 
  ON public.degree_programs FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Allow authenticated users to submit university requests (no client UPDATE/DELETE)
DROP POLICY IF EXISTS "Allow authenticated users to submit university requests" ON public.university_requests;
CREATE POLICY "Allow authenticated users to submit university requests" 
  ON public.university_requests FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- 6. Seed initial reference data
DO $$
DECLARE
  v_comsats_id UUID;
BEGIN
  -- Insert COMSATS University Islamabad (Attock Campus) if not present
  INSERT INTO public.universities (name)
  VALUES ('COMSATS University Islamabad (Attock Campus)')
  ON CONFLICT ((lower(name))) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_comsats_id;

  -- Insert Software Engineering degree program for COMSATS
  IF v_comsats_id IS NOT NULL THEN
    INSERT INTO public.degree_programs (university_id, name)
    VALUES (v_comsats_id, 'Software Engineering')
    ON CONFLICT (university_id, (lower(name))) DO NOTHING;
  END IF;
END $$;

-- 7. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
