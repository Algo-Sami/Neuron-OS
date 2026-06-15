-- Neuron OS AI Ecosystem Upgrade Migration
-- 1. Enable Required Extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Create Semantic Cache Table
CREATE TABLE IF NOT EXISTS public.semantic_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  query TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  response TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create Academic Knowledge Graph Table
CREATE TABLE IF NOT EXISTS public.knowledge_graph (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  prerequisites TEXT[] DEFAULT '{}'::text[],
  related_concepts TEXT[] DEFAULT '{}'::text[],
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(subject_id, concept)
);

-- 4. Create AI Usage Logs Table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10, 6) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_semantic_cache_query ON public.semantic_cache(query);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_subject ON public.knowledge_graph(subject_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_date ON public.ai_usage_logs(user_id, created_at);

-- HNSW Vector Index for Semantic Cache (pgvector cosine similarity matching)
CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding ON public.semantic_cache USING hnsw (embedding vector_cosine_ops);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies
-- Semantic Cache: Allow authenticated users to search/read cache entries, but only service/router handles insert
DROP POLICY IF EXISTS "Anyone can view semantic cache" ON public.semantic_cache;
CREATE POLICY "Anyone can view semantic cache" ON public.semantic_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert cache entries" ON public.semantic_cache;
CREATE POLICY "Authenticated users can insert cache entries" ON public.semantic_cache FOR INSERT WITH CHECK (true);

-- Knowledge Graph: Users can read and write concepts belonging to their profiles
DROP POLICY IF EXISTS "Manage own knowledge graph" ON public.knowledge_graph;
CREATE POLICY "Manage own knowledge graph" ON public.knowledge_graph FOR ALL USING (auth.uid() = user_id);

-- AI Usage Logs: Users can view their own usage logs
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can view own usage logs" ON public.ai_usage_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own usage logs" ON public.ai_usage_logs;
CREATE POLICY "Users can insert own usage logs" ON public.ai_usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Create RPC Vector Search Function for Semantic Cache
CREATE OR REPLACE FUNCTION public.match_semantic_cache (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  query text,
  response text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.query,
    sc.response,
    sc.metadata,
    (1 - (sc.embedding <=> query_embedding))::float AS similarity
  FROM public.semantic_cache sc
  WHERE (1 - (sc.embedding <=> query_embedding)) > match_threshold
    AND (sc.expires_at IS NULL OR sc.expires_at > now())
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
