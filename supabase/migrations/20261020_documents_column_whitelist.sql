-- ==============================================================================
-- Migration: 20261020_documents_column_whitelist.sql
-- Subsystem: Documents Security Hardening (Phase 7 - Part C)
--
-- Objective:
-- 1. Revoke unconstrained UPDATE on public.documents from authenticated/anon.
--    The existing "Manage own documents" RLS policy is FOR ALL, which already
--    gates rows by user_id, but it does NOT restrict which columns a user can
--    write — meaning an authenticated user can currently set summary_status,
--    quiz_status, ai_cooldown_until, shared_cohort_id, etc. directly.
-- 2. Grant UPDATE only on the explicit whitelist of columns the user's own
--    client is legitimately allowed to mutate.
--
-- After this migration the following columns are strictly server-managed and
-- cannot be set by a user's JWT-authenticated client:
--   summary_status, quiz_status, study_guide_status, flashcards_status,
--   mindmap_status, ai_cooldown_until, ai_last_failed_at, ai_error_category,
--   ai_error_code, ai_error_message, user_id, id, created_at, upload_id
--
-- NOTE: is_shared, shared_cohort_id, shared_at ARE in the whitelist because
-- they are written by shareDocument / unshareDocument server actions. The
-- existing DB trigger (set_document_shared_cohort) immediately overwrites
-- shared_cohort_id with the authoritative value from profiles, preventing
-- cohort forgery even if the user passes a wrong value.
--
-- The scheduler worker uses the SERVICE_ROLE key (bypasses RLS + column ACL)
-- and is unaffected by this change.
--
-- CRITICAL DEVELOPER NOTICE:
-- This is a strict column-level whitelist. ANY new user-editable column added
-- to `public.documents` in future migrations MUST be explicitly granted below:
--
--   GRANT UPDATE (<col>) ON public.documents TO authenticated;
--
-- Omitting a column from the whitelist will cause client updates that touch
-- that column to fail with PostgreSQL error 42501.
-- ==============================================================================

-- 1. Revoke table-level UPDATE (INSERT + DELETE are unchanged — users create
--    and permanently delete their own documents through guarded paths).
REVOKE UPDATE ON public.documents FROM authenticated, anon;

-- 2. Grant UPDATE only on explicitly permitted user-editable columns.
GRANT UPDATE (
  title,
  subject_id,
  folder_id,
  ai_subject,
  ai_topic,
  classification_status,
  classification_confidence,
  deleted_at,
  is_shared,
  shared_cohort_id,
  shared_at,
  updated_at
) ON public.documents TO authenticated;

-- 3. Existing RLS policies on public.documents are unchanged:
--    "Manage own documents"          FOR ALL USING (auth.uid() = user_id)
--    "View shared documents"         FOR SELECT (legacy shared_notes ACL)
--    "Cohort peers can view shared"  FOR SELECT (is_shared + matching cohort)
-- Column ACL is additive on top of RLS.

NOTIFY pgrst, 'reload schema';
