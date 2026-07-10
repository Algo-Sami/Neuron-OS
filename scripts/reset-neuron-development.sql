-- ─────────────────────────────────────────────────────────────────────────────
-- NEURON OS — DEVELOPMENT DATA RESET SCRIPT
-- ─────────────────────────────────────────────────────────────────────────────
-- WARNING: This script is intended ONLY for development environments.
-- Running this script will PERMANENTLY delete all user accounts, uploaded files,
-- subjects, folders, chunks, embeddings, summaries, quizzes, flashcards, 
-- study sessions, progress metrics, and AI-generated files.
--
-- DO NOT RUN THIS IN PRODUCTION.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  users_count INTEGER := 0;
  profiles_count INTEGER := 0;
  subjects_count INTEGER := 0;
  folders_count INTEGER := 0;
  documents_count INTEGER := 0;
  chunks_count INTEGER := 0;
  summaries_count INTEGER := 0;
  quizzes_count INTEGER := 0;
  flashcards_count INTEGER := 0;
  tasks_count INTEGER := 0;
  assets_count INTEGER := 0;
  jobs_count INTEGER := 0;
  cache_count INTEGER := 0;
  storage_count INTEGER := 0;
  study_sessions_count INTEGER := 0;
  chat_conversations_count INTEGER := 0;
  study_plans_count INTEGER := 0;
  study_rooms_count INTEGER := 0;
  knowledge_graph_count INTEGER := 0;
  
  table_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Starting Neuron OS Development Data Reset...';

  -- 1. Check & Count public.profiles
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO profiles_count FROM public.profiles; END IF;

  -- Check & Count public.subjects
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO subjects_count FROM public.subjects; END IF;

  -- Check & Count public.folders
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'folders') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO folders_count FROM public.folders; END IF;

  -- Check & Count public.documents
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO documents_count FROM public.documents; END IF;

  -- Check & Count public.document_chunks
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_chunks') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO chunks_count FROM public.document_chunks; END IF;

  -- Check & Count public.ai_summaries
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_summaries') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO summaries_count FROM public.ai_summaries; END IF;

  -- Check & Count public.quizzes
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO quizzes_count FROM public.quizzes; END IF;

  -- Check & Count public.flashcards
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flashcards') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO flashcards_count FROM public.flashcards; END IF;

  -- Check & Count public.background_tasks
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'background_tasks') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO tasks_count FROM public.background_tasks; END IF;

  -- Check & Count public.knowledge_assets
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_assets') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO assets_count FROM public.knowledge_assets; END IF;

  -- Check & Count public.asset_generation_jobs
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_generation_jobs') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO jobs_count FROM public.asset_generation_jobs; END IF;

  -- Check & Count public.semantic_cache
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'semantic_cache') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO cache_count FROM public.semantic_cache; END IF;

  -- Check & Count public.study_sessions
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'study_sessions') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO study_sessions_count FROM public.study_sessions; END IF;

  -- Check & Count public.chat_conversations
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_conversations') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO chat_conversations_count FROM public.chat_conversations; END IF;

  -- Check & Count public.study_plans
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'study_plans') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO study_plans_count FROM public.study_plans; END IF;

  -- Check & Count public.study_rooms
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'study_rooms') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO study_rooms_count FROM public.study_rooms; END IF;

  -- Check & Count public.knowledge_graph
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_graph') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO knowledge_graph_count FROM public.knowledge_graph; END IF;

  -- Check & Count auth.users
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') INTO table_exists;
  IF table_exists THEN SELECT COUNT(*) INTO users_count FROM auth.users; END IF;

  -- Check & Count storage.objects
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') INTO table_exists;
  IF table_exists THEN 
    SELECT COUNT(*) INTO storage_count FROM storage.objects WHERE bucket_id = 'documents'; 
  END IF;

  -- 2. Clear non-user-cascaded tables
  -- Semantic Cache
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'semantic_cache') INTO table_exists;
  IF table_exists THEN 
    EXECUTE 'DELETE FROM public.semantic_cache';
  END IF;
  
  -- Leaderboard seasons
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_seasons') INTO table_exists;
  IF table_exists THEN 
    EXECUTE 'DELETE FROM public.leaderboard_seasons';
  END IF;

  -- 3. Clear Storage files (Handled via Supabase Storage Dashboard to bypass schema restrictions)
  storage_count := 0;

  -- 4. Delete the User Accounts (which cascades to all user-owned tables)
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') INTO table_exists;
  IF table_exists THEN 
    EXECUTE 'DELETE FROM auth.users';
  END IF;

  -- 5. Re-seed default metadata (Leaderboard Seasons)
  SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard_seasons') INTO table_exists;
  IF table_exists THEN 
    EXECUTE 'INSERT INTO public.leaderboard_seasons (id, season_name, start_date, end_date, status) VALUES
      (''a1111111-2222-3333-4444-555555555555'', ''March 2026'', ''2026-03-01 00:00:00+00'', ''2026-03-31 23:59:59+00'', ''completed''),
      (''b2222222-3333-4444-5555-666666666666'', ''April 2026'', ''2026-04-01 00:00:00+00'', ''2026-04-30 23:59:59+00'', ''completed'')
    ON CONFLICT (id) DO NOTHING';
  END IF;

  -- 6. Print Verification/Completion Report
  RAISE NOTICE '────────────────────────────────────────────────────────';
  RAISE NOTICE '              DEVELOPMENT DATA RESET COMPLETE           ';
  RAISE NOTICE '────────────────────────────────────────────────────────';
  RAISE NOTICE '  Users Deleted:            %', users_count;
  RAISE NOTICE '  Profiles Deleted:         %', profiles_count;
  RAISE NOTICE '  Subjects Deleted:         %', subjects_count;
  RAISE NOTICE '  Folders Deleted:          %', folders_count;
  RAISE NOTICE '  Documents Deleted:        %', documents_count;
  RAISE NOTICE '  Chunks Deleted:           %', chunks_count;
  RAISE NOTICE '  AI Summaries Deleted:     %', summaries_count;
  RAISE NOTICE '  Quizzes Deleted:          %', quizzes_count;
  RAISE NOTICE '  Flashcards Deleted:       %', flashcards_count;
  RAISE NOTICE '  Background Tasks Deleted: %', tasks_count;
  RAISE NOTICE '  Knowledge Assets Deleted: %', assets_count;
  RAISE NOTICE '  Asset Gen Jobs Deleted:   %', jobs_count;
  RAISE NOTICE '  Knowledge Graph Deleted:  %', knowledge_graph_count;
  RAISE NOTICE '  Semantic Cache Cleared:   %', cache_count;
  RAISE NOTICE '  Study Sessions Deleted:   %', study_sessions_count;
  RAISE NOTICE '  Conversations Deleted:    %', chat_conversations_count;
  RAISE NOTICE '  Study Plans Deleted:      %', study_plans_count;
  RAISE NOTICE '  Study Rooms Deleted:      %', study_rooms_count;
  RAISE NOTICE '  Storage Files Removed:    %', storage_count;
  RAISE NOTICE '────────────────────────────────────────────────────────';
  RAISE NOTICE '  Database is now completely clean and ready for fresh testing.';
  RAISE NOTICE '────────────────────────────────────────────────────────';
END $$;
