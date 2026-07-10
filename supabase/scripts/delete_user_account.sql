-- =======================================================
-- NEURON OS — USER ACCOUNT DELETION FUNCTION
-- =======================================================
-- HOW TO APPLY:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. You should see: "Success. No rows returned."
--   4. The function will appear under Database → Functions
--
-- This only needs to be run ONCE per Supabase project.
-- If the function already exists, CREATE OR REPLACE updates it safely.
-- =======================================================

-- Drop if it exists in a broken state, then recreate cleanly
DROP FUNCTION IF EXISTS public.delete_user_account();

-- Create the production-ready account deletion function
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid UUID;
BEGIN
  -- Step 1: Verify an authenticated session exists
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated. You must be logged in to delete your account.'
    );
  END IF;

  -- Step 2: Confirm the user actually exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _uid) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User account not found.'
    );
  END IF;

  -- Step 3: Delete database records owned by the user.
  -- All public.* tables with user_id -> profiles(id) ON DELETE CASCADE
  -- are automatically removed via PostgreSQL foreign key cascade rules when profiles row is deleted.
  DELETE FROM public.profiles WHERE id = _uid;

  -- Step 4: Delete the authentication account.
  DELETE FROM auth.users WHERE id = _uid;

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    -- Roll back automatically (plpgsql transaction) and return error details
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account deletion failed: ' || SQLERRM
    );
END;
$$;

-- Grant execution permission ONLY to authenticated users (not anon)
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Force PostgREST to reload its schema cache so the RPC is immediately available
-- without needing a server restart or waiting for the cache to expire.
NOTIFY pgrst, 'reload schema';
