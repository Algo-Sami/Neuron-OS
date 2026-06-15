-- Neuron Study Rooms Database Schema
-- Run this in your Supabase SQL Editor to initialize the Study Rooms platform tables.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLEAN EXISTING TABLES
DROP TABLE IF EXISTS public.ai_meeting_summaries CASCADE;
DROP TABLE IF EXISTS public.room_analytics CASCADE;
DROP TABLE IF EXISTS public.room_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.room_quizzes CASCADE;
DROP TABLE IF EXISTS public.collaborative_notes CASCADE;
DROP TABLE IF EXISTS public.room_messages CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.study_rooms CASCADE;

-- 2. STUDY ROOMS
CREATE TABLE public.study_rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Creator/Host
  name TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic TEXT,
  max_participants INTEGER DEFAULT 10,
  description TEXT,
  privacy TEXT DEFAULT 'public', -- public, private, subject, exam, team
  scheduled_time TIMESTAMP WITH TIME ZONE,
  ai_assistant_enabled BOOLEAN DEFAULT true,
  code TEXT UNIQUE NOT NULL, -- 6-char alphanumeric invite code (e.g. abc123)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ROOM MEMBERS (Presence and membership mapping)
CREATE TABLE public.room_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member', -- host, member
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_id, user_id)
);

-- 4. ROOM MESSAGES (Live chat logs)
CREATE TABLE public.room_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. COLLABORATIVE NOTES & WHITEBOARD COORDINATES
CREATE TABLE public.collaborative_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL UNIQUE,
  content TEXT DEFAULT '',
  whiteboard_data JSONB DEFAULT '{}'::jsonb, -- drawing vector shapes/positions
  active_lecture_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- shared lecture note document
  active_lecture_page INTEGER DEFAULT 1, -- synchronized page page
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ROOM QUIZZES
CREATE TABLE public.room_quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  questions JSONB NOT NULL, -- generated quiz questions list
  active_question_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ROOM QUIZ ATTEMPTS
CREATE TABLE public.room_quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_quiz_id UUID REFERENCES public.room_quizzes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL, -- submitted options
  score INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_quiz_id, user_id)
);

-- 8. ROOM ANALYTICS (Aggregated stats log)
CREATE TABLE public.room_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL UNIQUE,
  duration_minutes INTEGER DEFAULT 0,
  participation_metrics JSONB DEFAULT '{}'::jsonb, -- speaking durations, chat message counts, correct quiz ratings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. AI MEETING SUMMARIES
CREATE TABLE public.ai_meeting_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE NOT NULL,
  summary_text TEXT NOT NULL,
  key_points JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. INDEXES FOR FAST PERFORMANCE
CREATE INDEX idx_study_rooms_code ON public.study_rooms(code);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);
CREATE INDEX idx_room_messages_room ON public.room_messages(room_id);
CREATE INDEX idx_collaborative_notes_room ON public.collaborative_notes(room_id);
CREATE INDEX idx_room_quizzes_room ON public.room_quizzes(room_id);
CREATE INDEX idx_room_quiz_attempts_user ON public.room_quiz_attempts(user_id);
CREATE INDEX idx_ai_meeting_summaries_room ON public.ai_meeting_summaries(room_id);

-- 11. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborative_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_meeting_summaries ENABLE ROW LEVEL SECURITY;

-- 12. DEFINE OWNERSHIP & COOPERATIVE SECURITY RLS POLICIES
CREATE POLICY "Anyone can view study rooms" ON public.study_rooms FOR SELECT USING (true);
CREATE POLICY "Hosts can manage study rooms" ON public.study_rooms FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can participate in room memberships" ON public.room_members FOR ALL USING (true);
CREATE POLICY "Anyone can exchange room messages" ON public.room_messages FOR ALL USING (true);
CREATE POLICY "Anyone can edit collaborative notes" ON public.collaborative_notes FOR ALL USING (true);
CREATE POLICY "Anyone can view room quizzes" ON public.room_quizzes FOR ALL USING (true);
CREATE POLICY "Anyone can submit quiz attempts" ON public.room_quiz_attempts FOR ALL USING (true);
CREATE POLICY "Anyone can track room analytics" ON public.room_analytics FOR ALL USING (true);
CREATE POLICY "Anyone can view meeting summaries" ON public.ai_meeting_summaries FOR ALL USING (true);

-- 13. REGISTER UPDATED_AT TRIGGERS
CREATE TRIGGER set_study_rooms_updated_at BEFORE UPDATE ON public.study_rooms FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_collaborative_notes_updated_at BEFORE UPDATE ON public.collaborative_notes FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
