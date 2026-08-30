-- Migration: 20260830_subject_classification_system.sql
-- Description: Production-Grade Subject Classification & Upload Routing Infrastructure

-- 1. Extend SUBJECTS table with optional metadata
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS representative_concepts TEXT[];

-- 2. SUBJECT ALIASES TABLE
-- Stores validated and learned aliases for user subjects (e.g. DBMS -> Database Management Systems)
CREATE TABLE IF NOT EXISTS public.subject_aliases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  alias TEXT NOT NULL,
  source TEXT DEFAULT 'system' CHECK (source IN ('system', 'user', 'confirmed', 'learned')),
  confidence NUMERIC(3,2) DEFAULT 1.00 CHECK (confidence >= 0.00 AND confidence <= 1.00),
  usage_count INTEGER DEFAULT 1 CHECK (usage_count >= 1),
  validated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Case-insensitive unique constraint per subject + alias
CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_aliases_unique 
ON public.subject_aliases(subject_id, lower(alias));

CREATE INDEX IF NOT EXISTS idx_subject_aliases_subject_id 
ON public.subject_aliases(subject_id);

CREATE INDEX IF NOT EXISTS idx_subject_aliases_alias_lower 
ON public.subject_aliases(lower(alias));

-- 3. SUBJECT PROFILES TABLE
-- Stores semantic profile and vector embedding for content-based classification
CREATE TABLE IF NOT EXISTS public.subject_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  profile_text TEXT,
  representative_concepts TEXT[],
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subject_profiles_subject_id 
ON public.subject_profiles(subject_id);

-- 4. CLASSIFICATION EVENTS TABLE
-- Audit log and telemetry for classification decisions and learning from user corrections
CREATE TABLE IF NOT EXISTS public.classification_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  predicted_subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  final_subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0.00 AND confidence <= 1.00),
  method TEXT NOT NULL,
  user_corrected BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classification_events_user_id 
ON public.classification_events(user_id);

CREATE INDEX IF NOT EXISTS idx_classification_events_doc_id 
ON public.classification_events(document_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.subject_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_events ENABLE ROW LEVEL SECURITY;

-- Subject Aliases RLS: User can manage aliases belonging to their own subjects
CREATE POLICY "Manage own subject aliases" ON public.subject_aliases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_aliases.subject_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_aliases.subject_id
      AND s.user_id = auth.uid()
    )
  );

-- Subject Profiles RLS: User can manage profiles belonging to their own subjects
CREATE POLICY "Manage own subject profiles" ON public.subject_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_profiles.subject_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_profiles.subject_id
      AND s.user_id = auth.uid()
    )
  );

-- Classification Events RLS: User can manage their own classification events
CREATE POLICY "Manage own classification events" ON public.classification_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_classification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_subject_aliases_updated_at
  BEFORE UPDATE ON public.subject_aliases
  FOR EACH ROW EXECUTE PROCEDURE public.handle_classification_updated_at();

CREATE TRIGGER set_subject_profiles_updated_at
  BEFORE UPDATE ON public.subject_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_classification_updated_at();
