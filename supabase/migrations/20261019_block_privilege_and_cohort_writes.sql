-- ==============================================================================
-- Migration: 20261019_block_privilege_and_cohort_writes.sql
-- Subsystem: Profiles & Documents Security Hardening (Phase 7 - Part A)
--
-- Objective:
-- 1. Revoke raw INSERT, UPDATE, DELETE on public.profiles from authenticated & anon.
-- 2. Grant column-limited UPDATE only on legitimate student-editable attributes.
--    (Privilege columns: is_premium, boost_*, cohort_id, xp_points, streak_count
--     become strictly server/trigger-managed).
-- 3. Harden cohort trigger to fire on all updates and always derive cohort_id.
-- 4. Add security-definer trigger on documents to strictly bind shared_cohort_id
--    to the owner's authoritative profiles.cohort_id, preventing forgery.
-- ==============================================================================

-- ── 1. Column-Level Permission Whitelist on public.profiles ───────────────────
-- CRITICAL DEVELOPER NOTICE:
-- Table-level write privileges are revoked. The grant below operates as an explicit
-- strict whitelist. ANY new student-editable column added to `public.profiles` in
-- future schema migrations MUST be explicitly added via `GRANT UPDATE (<col>) ON
-- public.profiles TO authenticated;`. Omitting a column from this whitelist will cause
-- student profile saves that touch that column to fail with PostgreSQL error 42501
-- ("permission denied for table profiles").
--
-- Revoke all table-level write operations
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated, anon;

-- Grant UPDATE only on explicitly permitted student-editable columns
GRANT UPDATE (
  first_name,
  last_name,
  full_name,
  username,
  bio,
  university,
  major,
  degree_program,
  semester,
  university_id,
  program_id,
  profile_image,
  avatar_url,
  interests,
  study_goals,
  country,
  timezone,
  leaderboard_visibility,
  updated_at
) ON public.profiles TO authenticated;

-- ── 2. Harden Cohort Trigger on public.profiles ───────────────────────────────

CREATE OR REPLACE FUNCTION public.get_or_create_cohort()
RETURNS trigger AS $$
DECLARE
  v_cohort_id UUID;
BEGIN
  -- If any defining attribute is missing or blank, clear cohort_id
  IF NEW.university_id IS NULL OR NEW.program_id IS NULL OR NEW.semester IS NULL OR trim(NEW.semester) = '' THEN
    NEW.cohort_id := NULL;
  ELSE
    -- Trim semester whitespace
    NEW.semester := trim(NEW.semester);

    -- Concurrency-safe insert of the cohort
    INSERT INTO public.cohorts (university_id, program_id, semester)
    VALUES (NEW.university_id, NEW.program_id, NEW.semester)
    ON CONFLICT (university_id, program_id, semester) DO NOTHING;

    -- Retrieve the stable cohort ID
    SELECT id INTO v_cohort_id
    FROM public.cohorts
    WHERE university_id = NEW.university_id
      AND program_id = NEW.program_id
      AND semester = NEW.semester;

    NEW.cohort_id := v_cohort_id;
  END IF;

  -- If cohort changed on an existing profile, unshare any documents from the old cohort
  -- to prevent old semester files from lingering in previous class notes feeds.
  IF TG_OP = 'UPDATE' AND (OLD.cohort_id IS DISTINCT FROM NEW.cohort_id) THEN
    UPDATE public.documents
    SET is_shared = false, shared_cohort_id = NULL, shared_at = NULL
    WHERE user_id = NEW.id AND is_shared = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-bind trigger to fire on ANY update (not just specific columns) so manual cohort_id tampering is impossible
DROP TRIGGER IF EXISTS trigger_profile_cohort ON public.profiles;
CREATE TRIGGER trigger_profile_cohort
  BEFORE INSERT OR UPDATE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.get_or_create_cohort();

-- ── 3. Enforce Shared Cohort ID Trigger on public.documents ──────────────────

CREATE OR REPLACE FUNCTION public.enforce_document_share_cohort()
RETURNS trigger AS $$
DECLARE
  v_owner_cohort_id UUID;
BEGIN
  IF NEW.is_shared THEN
    -- Look up the document owner's authoritative cohort_id
    SELECT cohort_id INTO v_owner_cohort_id
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- If owner has no cohort, document cannot be shared
    IF v_owner_cohort_id IS NULL THEN
      NEW.is_shared := false;
      NEW.shared_cohort_id := NULL;
      NEW.shared_at := NULL;
    ELSE
      -- Overwrite any client-supplied shared_cohort_id with the owner's true cohort
      NEW.shared_cohort_id := v_owner_cohort_id;
      NEW.shared_at := COALESCE(NEW.shared_at, now());
    END IF;
  ELSE
    -- Document is private: clear cohort linkage
    NEW.shared_cohort_id := NULL;
    NEW.shared_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_document_share_cohort ON public.documents;
CREATE TRIGGER trg_enforce_document_share_cohort
  BEFORE INSERT OR UPDATE
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_share_cohort();

NOTIFY pgrst, 'reload schema';
