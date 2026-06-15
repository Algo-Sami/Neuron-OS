-- Neuron OS Supabase PostgreSQL Schema

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 0. Clean Existing Schema (Ensures a clean application of the new architecture)
DROP TABLE IF EXISTS public.shared_notes CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.study_sessions CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.flashcards CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.ai_summaries CASCADE;
DROP TABLE IF EXISTS public.document_chunks CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.uploads CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Core Tables

-- PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  university TEXT,
  major TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SUBJECTS
CREATE TABLE public.subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FOLDERS
CREATE TABLE public.folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. File & Document Processing Tables

-- UPLOADS (Audit Log & Raw Storage Reference)
CREATE TABLE public.uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DOCUMENTS (Primary AI Entity)
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  ai_subject TEXT,
  ai_topic TEXT,
  ai_doc_type TEXT,
  classification_confidence NUMERIC(3,2),
  classification_status TEXT DEFAULT 'pending',
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  tags TEXT[],
  semantic_embedding vector(1536), -- Optimized for OpenAI embeddings
  summary_status TEXT DEFAULT 'pending', -- pending, completed, failed
  quiz_status TEXT DEFAULT 'pending', -- pending, generated, none
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- DOCUMENT_CHUNKS (For RAG)
CREATE TABLE public.document_chunks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI_SUMMARIES
CREATE TABLE public.ai_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  summary_text TEXT NOT NULL,
  key_points TEXT[],
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Learning & Assessment Tables

-- QUIZZES
CREATE TABLE public.quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  score INTEGER,
  total_questions INTEGER NOT NULL,
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FLASHCARDS
CREATE TABLE public.flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  front_content TEXT NOT NULL,
  back_content TEXT NOT NULL,
  next_review_date TIMESTAMP WITH TIME ZONE,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- REMINDERS
CREATE TABLE public.reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL, -- assignment, exam, generic
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  extracted_from_ai BOOLEAN DEFAULT false,
  completed_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tracking & Gamification Tables

-- ACHIEVEMENTS (Global Catalog)
CREATE TABLE public.achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- USER_ACHIEVEMENTS (Mapping)
CREATE TABLE public.user_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, achievement_id)
);

-- USER_PROGRESS
CREATE TABLE public.user_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STUDY_SESSIONS
CREATE TABLE public.study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  focus_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- alert, reminder, system
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Collaboration

-- SHARED_NOTES (Granular ACL model)
CREATE TABLE public.shared_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  share_token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  permission_level TEXT DEFAULT 'view', -- view, edit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CHAT_CONVERSATIONS (For saving RAG chats and threads)
CREATE TABLE public.chat_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CHAT_MESSAGES (For storing thread logs and source references)
CREATE TABLE public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL, -- user, ai, system
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Indexes

-- B-Tree Indexes for Foreign Keys and common lookups
CREATE INDEX idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_subject_id ON public.documents(subject_id);
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX idx_shared_notes_token ON public.shared_notes(share_token);
CREATE INDEX idx_shared_notes_shared_with ON public.shared_notes(shared_with_user_id);
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- Vector Indexes (HNSW for highly scalable and fast approximate nearest neighbor search)
CREATE INDEX idx_documents_embedding ON public.documents USING hnsw (semantic_embedding vector_cosine_ops);
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_ai_summaries_embedding ON public.ai_summaries USING hnsw (embedding vector_cosine_ops);

-- 8. Security & Row Level Security (RLS)

-- Enable RLS on all applicable tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Standard Ownership Policies
CREATE POLICY "Manage own subjects" ON public.subjects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own folders" ON public.folders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own uploads" ON public.uploads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own quizzes" ON public.quizzes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own user_achievements" ON public.user_achievements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own user_progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own study_sessions" ON public.study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Documents Policy (Owner access + Shared Access via ACL)
CREATE POLICY "Manage own documents" ON public.documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "View shared documents" ON public.documents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.shared_notes sn 
    WHERE sn.document_id = public.documents.id AND sn.shared_with_user_id = auth.uid()
  )
);

-- Document Chunks Policy (Inherits from Documents)
CREATE POLICY "Manage own document chunks" ON public.document_chunks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_chunks.document_id AND d.user_id = auth.uid()
  )
);
CREATE POLICY "View shared document chunks" ON public.document_chunks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.shared_notes sn ON sn.document_id = d.id
    WHERE d.id = document_chunks.document_id AND sn.shared_with_user_id = auth.uid()
  )
);

-- AI Summaries Policy (Inherits from Documents)
CREATE POLICY "Manage own summaries" ON public.ai_summaries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = ai_summaries.document_id AND d.user_id = auth.uid()
  )
);
CREATE POLICY "View shared summaries" ON public.ai_summaries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.shared_notes sn ON sn.document_id = d.id
    WHERE d.id = ai_summaries.document_id AND sn.shared_with_user_id = auth.uid()
  )
);

-- Achievements Catalog
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Anyone can insert achievements" ON public.achievements FOR INSERT WITH CHECK (true);

-- Shared Notes ACL Policy
CREATE POLICY "Manage own shared notes" ON public.shared_notes FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "View shared notes granted to me" ON public.shared_notes FOR SELECT USING (auth.uid() = shared_with_user_id);

-- Chat Conversations Policy (User ownership RLS)
CREATE POLICY "Manage own chat_conversations" ON public.chat_conversations FOR ALL USING (auth.uid() = user_id);

-- Chat Messages Policy (Inherited user ownership RLS)
CREATE POLICY "Manage own chat_messages" ON public.chat_messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
  )
);

-- 9. Utility Functions & Triggers

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_uploads_updated_at BEFORE UPDATE ON public.uploads FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_ai_summaries_updated_at BEFORE UPDATE ON public.ai_summaries FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_flashcards_updated_at BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_shared_notes_updated_at BEFORE UPDATE ON public.shared_notes FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Auth user creation trigger for profile and progress initialization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  
  -- Initialize user progress tracking
  INSERT INTO public.user_progress (user_id) VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (drop first to avoid conflict if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Seed Default Achievements Catalog
INSERT INTO public.achievements (name, description, icon_url, xp_reward) VALUES
('First of Many', 'Upload your first study document.', 'FileText', 150),
('Knowledge Collector', 'Upload 5 study documents to your library.', 'BookOpen', 300),
('Quiz Whiz', 'Complete your first dynamic study quiz.', 'Zap', 200),
('Perfect Score', 'Answer all questions correctly in a quiz.', 'Award', 350),
('Collaborator', 'Share study materials with your classmates.', 'Share2', 150),
('Focus Initiate', 'Complete your first deep focus study session.', 'Clock', 200),
('Daily Streak Starter', 'Perform daily actions 3 days in a row.', 'Flame', 250),
('Neuron Scholar', 'Reach Level 5 and prove your academic commitment.', 'Sparkles', 500)
ON CONFLICT (name) DO NOTHING;

-- 10. Vector Similarity Matching Functions for RAG

-- Match document chunks by cosine distance
CREATE OR REPLACE FUNCTION public.match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_ids uuid[] DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Match documents by semantic embedding similarity
CREATE OR REPLACE FUNCTION public.match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    (1 - (d.semantic_embedding <=> query_embedding))::float AS similarity
  FROM public.documents d
  WHERE (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND (1 - (d.semantic_embedding <=> query_embedding)) > match_threshold
  ORDER BY d.semantic_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
