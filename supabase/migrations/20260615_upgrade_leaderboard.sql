-- ==========================================
-- NEURON LEADERBOARD & XP SYSTEM UPGRADE SQL
-- ==========================================
-- Paste this script into your Supabase SQL Editor to upgrade the tables,
-- establish RLS permissions, and seed high-fidelity peer competitor data.

-- 1. Extend user_progress with detailed gamification columns
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS monthly_xp INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS quiz_accuracy INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS completed_quizzes_count INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS total_correct_answers INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS total_questions_attempted INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS highest_streak INTEGER DEFAULT 0;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS daily_challenges JSONB DEFAULT '{"date": "", "completed": {"focus": false, "quiz": false, "share": false}}'::jsonb;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS last_active_date TEXT;
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS last_check_in_date TEXT;

-- 2. Create Leaderboard Seasons table
CREATE TABLE IF NOT EXISTS public.leaderboard_seasons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_name TEXT NOT NULL, -- e.g. "May 2026", "June 2026"
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'completed', -- 'active', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Monthly Champions / Archive table
CREATE TABLE IF NOT EXISTS public.monthly_champions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_id UUID REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER NOT NULL,
  total_xp INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS on new tables
ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_champions ENABLE ROW LEVEL SECURITY;

-- 5. Establish RLS Policies
DROP POLICY IF EXISTS "Anyone can view leaderboard seasons" ON public.leaderboard_seasons;
CREATE POLICY "Anyone can view leaderboard seasons" ON public.leaderboard_seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view monthly champions" ON public.monthly_champions;
CREATE POLICY "Anyone can view monthly champions" ON public.monthly_champions FOR SELECT USING (true);

-- Allow anyone to view profiles (needed for public leaderboard names)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);

-- Allow anyone to view progress records (needed for public leaderboard rankings)
DROP POLICY IF EXISTS "Manage own user_progress" ON public.user_progress;
DROP POLICY IF EXISTS "Anyone can view user progress" ON public.user_progress;
CREATE POLICY "Anyone can view user progress" ON public.user_progress FOR SELECT USING (true);

-- Ensure updating/inserting/deleting own progress records remains secure
DROP POLICY IF EXISTS "Users can update own user_progress" ON public.user_progress;
CREATE POLICY "Users can update own user_progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user_progress" ON public.user_progress;
CREATE POLICY "Users can insert own user_progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own user_progress" ON public.user_progress;
CREATE POLICY "Users can delete own user_progress" ON public.user_progress FOR DELETE USING (auth.uid() = user_id);

-- 6. Add trigger updates to keep monthly_xp in sync if old code does basic updates on total_xp
-- This provides bulletproof backward compatibility!
CREATE OR REPLACE FUNCTION public.sync_monthly_xp_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If total_xp was updated but monthly_xp was not explicitly changed,
  -- add the XP difference to monthly_xp as well!
  IF NEW.total_xp <> OLD.total_xp AND NEW.monthly_xp = OLD.monthly_xp THEN
    NEW.monthly_xp = OLD.monthly_xp + (NEW.total_xp - OLD.total_xp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_monthly_xp ON public.user_progress;
CREATE TRIGGER tr_sync_monthly_xp
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE PROCEDURE public.sync_monthly_xp_on_update();

-- 7. Seed past seasons and monthly champions history for high-fidelity aesthetics
INSERT INTO public.leaderboard_seasons (id, season_name, start_date, end_date, status) VALUES
('a1111111-2222-3333-4444-555555555555', 'March 2026', '2026-03-01 00:00:00+00', '2026-03-31 23:59:59+00', 'completed'),
('b2222222-3333-4444-5555-666666666666', 'April 2026', '2026-04-01 00:00:00+00', '2026-04-30 23:59:59+00', 'completed')
ON CONFLICT (id) DO NOTHING;

-- 8. Clean up and remove all seeded/fake competitor accounts
-- This deletes the mock accounts from auth.users (cascading to profiles, user_progress, and monthly_champions)
DELETE FROM auth.users WHERE id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555'
);
