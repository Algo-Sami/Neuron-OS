-- =======================================================
-- NEURON OS USER ACCOUNT DELETION SQL FUNCTION
-- =======================================================
-- Paste this script into your Supabase SQL Editor to enable
-- complete account deletion.
--
-- This function runs with SECURITY DEFINER privileges (as DB owner)
-- to bypass Row Level Security and delete the authenticated user
-- from the auth.users table. Foreign key ON DELETE CASCADE rules
-- will automatically delete the user's profile and all user data
-- from public tables (notes, uploads, quizzes, chats, progress, etc.)

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Validate that there is an active authenticated user calling this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete the user from auth.users (cascades to all other tables)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
