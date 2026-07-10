-- SQL Script: Reset Neuron OS to a Clean Testing State (Data Only)
-- Run this in the Supabase SQL Editor.
-- This script deletes all user-generated and AI-generated data while preserving user authentication accounts.

BEGIN;

-- Disable triggers temporarily to avoid check overhead
SET CONSTRAINTS ALL DEFERRED;

DO $$
BEGIN
  -- 1. AI Generated & RAG data
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_chunks') THEN
    DELETE FROM public.document_chunks;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_summaries') THEN
    DELETE FROM public.ai_summaries;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_knowledge') THEN
    DELETE FROM public.document_knowledge;
  END IF;

  -- 2. Quizzes, Flashcards & Reminders
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quizzes') THEN
    DELETE FROM public.quizzes;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'flashcards') THEN
    DELETE FROM public.flashcards;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reminders') THEN
    DELETE FROM public.reminders;
  END IF;

  -- 3. Uploads & Documents
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'uploads') THEN
    DELETE FROM public.uploads;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
    DELETE FROM public.documents;
  END IF;

  -- 4. Folder Hierarchy
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'folders') THEN
    DELETE FROM public.folders;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subjects') THEN
    DELETE FROM public.subjects;
  END IF;

  -- 5. Task queues & AI system logs
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'background_tasks') THEN
    DELETE FROM public.background_tasks;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'semantic_cache') THEN
    DELETE FROM public.semantic_cache;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_usage_logs') THEN
    DELETE FROM public.ai_usage_logs;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'knowledge_graph') THEN
    DELETE FROM public.knowledge_graph;
  END IF;

  -- 6. Chat conversations & messages
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
    DELETE FROM public.chat_messages;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_conversations') THEN
    DELETE FROM public.chat_conversations;
  END IF;

  -- 7. Study Rooms & collaboration
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'collaborative_notes') THEN
    DELETE FROM public.collaborative_notes;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_messages') THEN
    DELETE FROM public.room_messages;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_quiz_attempts') THEN
    DELETE FROM public.room_quiz_attempts;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_members') THEN
    DELETE FROM public.room_members;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_quizzes') THEN
    DELETE FROM public.room_quizzes;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_analytics') THEN
    DELETE FROM public.room_analytics;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_meeting_summaries') THEN
    DELETE FROM public.ai_meeting_summaries;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'study_rooms') THEN
    DELETE FROM public.study_rooms;
  END IF;

  -- 8. Notifications & Gamification state
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    DELETE FROM public.notifications;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_achievements') THEN
    DELETE FROM public.user_achievements;
  END IF;

  -- 9. Reset user progress instead of deleting (ensures users remain fully functional)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_progress') THEN
    UPDATE public.user_progress 
    SET total_xp = 0, 
        current_level = 1, 
        monthly_xp = 0, 
        quiz_accuracy = 0, 
        completed_quizzes_count = 0, 
        total_correct_answers = 0, 
        total_questions_attempted = 0, 
        current_streak = 0, 
        highest_streak = 0, 
        daily_challenges = '{"date": "", "completed": {"focus": false, "quiz": false, "share": false}}'::jsonb,
        last_active_date = null,
        last_check_in_date = null;
  END IF;

  -- 10. Storage cleanup is handled via the dashboard storage API (direct SQL delete is blocked by Supabase protect_delete trigger)
  NULL;
END $$;

COMMIT;
