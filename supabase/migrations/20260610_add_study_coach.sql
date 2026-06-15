-- Neuron Study Coach Database Schema
-- Run this in your Supabase SQL Editor to initialize the Study Coach system tables.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLEAN EXISTING TABLES (If any exist to prevent conflict during re-runs)
DROP TABLE IF EXISTS public.productivity_insights CASCADE;
DROP TABLE IF EXISTS public.exam_readiness CASCADE;
DROP TABLE IF EXISTS public.weakness_tracking CASCADE;
DROP TABLE IF EXISTS public.concept_evaluations CASCADE;
DROP TABLE IF EXISTS public.study_plans CASCADE;

-- 2. STUDY PLANS
CREATE TABLE public.study_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_data JSONB NOT NULL,
  hours_per_day INTEGER NOT NULL,
  exam_dates JSONB DEFAULT '{}'::jsonb,
  weak_subjects JSONB DEFAULT '[]'::jsonb,
  prep_level TEXT DEFAULT 'beginner',
  learning_style TEXT DEFAULT 'visual',
  backlog_subjects JSONB DEFAULT '[]'::jsonb,
  sleep_schedule TEXT,
  mood_level TEXT,
  academic_goals TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CONCEPT EVALUATIONS
CREATE TABLE public.concept_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  score INTEGER NOT NULL, -- Grade between 0 and 100
  feedback JSONB NOT NULL, -- { understanding_level, strengths, weak_areas, missing_concepts, suggestions }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. WEAKNESS TRACKING
CREATE TABLE public.weakness_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  weak_concepts JSONB DEFAULT '[]'::jsonb,
  strong_concepts JSONB DEFAULT '[]'::jsonb,
  confidence_levels JSONB DEFAULT '{}'::jsonb,
  health_score INTEGER DEFAULT 100, -- Dynamic health rating (0-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, subject_id)
);

-- 5. EXAM READINESS
CREATE TABLE public.exam_readiness (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  readiness_score INTEGER DEFAULT 0, -- Dynamic percentage (0-100)
  missing_topics JSONB DEFAULT '[]'::jsonb,
  predicted_topics JSONB DEFAULT '[]'::jsonb,
  rapid_revision_plan JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, subject_id)
);

-- 6. PRODUCTIVITY INSIGHTS
CREATE TABLE public.productivity_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  insights JSONB NOT NULL, -- { motivation, tips: [], burnout_detected: boolean, break_suggestions: [] }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. INDEXES FOR PERFORMANCE
CREATE INDEX idx_study_plans_user_id ON public.study_plans(user_id);
CREATE INDEX idx_concept_evaluations_user_id ON public.concept_evaluations(user_id);
CREATE INDEX idx_concept_evaluations_doc_id ON public.concept_evaluations(document_id);
CREATE INDEX idx_weakness_tracking_user_subject ON public.weakness_tracking(user_id, subject_id);
CREATE INDEX idx_exam_readiness_user_subject ON public.exam_readiness(user_id, subject_id);
CREATE INDEX idx_productivity_insights_user ON public.productivity_insights(user_id);

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weakness_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_insights ENABLE ROW LEVEL SECURITY;

-- 9. DEFINE OWNERSHIP RLS POLICIES
CREATE POLICY "Manage own study plans" ON public.study_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own concept evaluations" ON public.concept_evaluations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own weakness tracking" ON public.weakness_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own exam readiness" ON public.exam_readiness FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own productivity insights" ON public.productivity_insights FOR ALL USING (auth.uid() = user_id);

-- 10. SETUP UPDATED_AT TRIGGERS
CREATE TRIGGER set_study_plans_updated_at BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_weakness_tracking_updated_at BEFORE UPDATE ON public.weakness_tracking FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_exam_readiness_updated_at BEFORE UPDATE ON public.exam_readiness FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_productivity_insights_updated_at BEFORE UPDATE ON public.productivity_insights FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
