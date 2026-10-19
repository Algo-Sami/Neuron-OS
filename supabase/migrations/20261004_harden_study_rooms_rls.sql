-- ============================================================================
-- Migration: 20261004_harden_study_rooms_rls.sql
-- Hardening RLS policies on room_members, room_messages, and collaborative_notes
-- Fixes Problem 5 (High P1): Data privacy vulnerability on study room content
-- ============================================================================

-- 1. Helper function to check room membership without infinite recursion
-- Hardened with SECURITY DEFINER, STABLE execution, and explicit search_path = public
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.study_rooms
    WHERE id = p_room_id
      AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_room_member(UUID, UUID) TO authenticated, service_role;


-- 2. Code-based joining function for private and public study rooms
-- Validates invite code and adds the authenticated user to room_members safely
CREATE OR REPLACE FUNCTION public.join_study_room_with_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, privacy INTO v_room
  FROM public.study_rooms
  WHERE code = upper(trim(p_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study Room not found. Double check invite code.';
  END IF;

  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_room.id, v_user_id, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_study_room_with_code(TEXT) TO authenticated, service_role;


-- 3. Ensure UNIQUE constraint on collaborative_notes.room_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborative_notes_room_id_key'
  ) THEN
    ALTER TABLE public.collaborative_notes ADD CONSTRAINT collaborative_notes_room_id_key UNIQUE (room_id);
  END IF;
END $$;


-- ============================================================================
-- 4. POLICIES ON public.room_members
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can participate in room memberships" ON public.room_members;
DROP POLICY IF EXISTS "Members can view room roster" ON public.room_members;
DROP POLICY IF EXISTS "Users can join public rooms or hosts can add members" ON public.room_members;
DROP POLICY IF EXISTS "Hosts can update room memberships" ON public.room_members;
DROP POLICY IF EXISTS "Users can leave rooms or hosts can remove members" ON public.room_members;

-- SELECT: Confirmed members can see the roster of their room; users can see their own memberships
CREATE POLICY "Members can view room roster"
  ON public.room_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
  );

-- INSERT: Room creators can insert themselves/others, or users can self-join ONLY if room is 'public'
-- Private rooms require code verification (via join_study_room_with_code or admin action)
CREATE POLICY "Users can join public rooms or hosts can add members"
  ON public.room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Room host adding members or self
      EXISTS (
        SELECT 1 FROM public.study_rooms
        WHERE id = room_id AND user_id = auth.uid()
      )
      OR (
        -- User self-joining as 'member' ONLY in public rooms
        user_id = auth.uid()
        AND role = 'member'
        AND EXISTS (
          SELECT 1 FROM public.study_rooms
          WHERE id = room_id AND privacy = 'public'
        )
      )
    )
  );

-- UPDATE: Only room host can update membership roles
CREATE POLICY "Hosts can update room memberships"
  ON public.room_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_rooms
      WHERE id = room_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_rooms
      WHERE id = room_id AND user_id = auth.uid()
    )
  );

-- DELETE: User can leave (delete self), or host can remove a member
CREATE POLICY "Users can leave rooms or hosts can remove members"
  ON public.room_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.study_rooms
      WHERE id = room_id AND user_id = auth.uid()
    )
  );


-- ============================================================================
-- 5. POLICIES ON public.room_messages
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can exchange room messages" ON public.room_messages;
DROP POLICY IF EXISTS "Members can view room messages" ON public.room_messages;
DROP POLICY IF EXISTS "Members can post room messages" ON public.room_messages;
DROP POLICY IF EXISTS "Authors and hosts can update room messages" ON public.room_messages;
DROP POLICY IF EXISTS "Authors and hosts can delete room messages" ON public.room_messages;

-- SELECT: Only confirmed room members can read messages
CREATE POLICY "Members can view room messages"
  ON public.room_messages FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

-- INSERT: Only confirmed room members can post messages (as themselves)
CREATE POLICY "Members can post room messages"
  ON public.room_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_room_member(room_id, auth.uid())
  );

-- UPDATE: Author or host can edit/pin messages
CREATE POLICY "Authors and hosts can update room messages"
  ON public.room_messages FOR UPDATE
  TO authenticated
  USING (
    public.is_room_member(room_id, auth.uid())
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.study_rooms
        WHERE id = room_id AND user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_room_member(room_id, auth.uid())
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.study_rooms
        WHERE id = room_id AND user_id = auth.uid()
      )
    )
  );

-- DELETE: Author or host can delete messages
CREATE POLICY "Authors and hosts can delete room messages"
  ON public.room_messages FOR DELETE
  TO authenticated
  USING (
    public.is_room_member(room_id, auth.uid())
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.study_rooms
        WHERE id = room_id AND user_id = auth.uid()
      )
    )
  );


-- ============================================================================
-- 6. POLICIES ON public.collaborative_notes
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can edit collaborative notes" ON public.collaborative_notes;
DROP POLICY IF EXISTS "Members can view collaborative notes" ON public.collaborative_notes;
DROP POLICY IF EXISTS "Hosts can initialize collaborative notes" ON public.collaborative_notes;
DROP POLICY IF EXISTS "Members can update collaborative notes" ON public.collaborative_notes;
DROP POLICY IF EXISTS "Hosts can delete collaborative notes" ON public.collaborative_notes;

-- SELECT: Only confirmed room members can view notes and whiteboard
CREATE POLICY "Members can view collaborative notes"
  ON public.collaborative_notes FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

-- INSERT: Only room host can initialize the single collaborative notes record
CREATE POLICY "Hosts can initialize collaborative notes"
  ON public.collaborative_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_rooms
      WHERE id = room_id AND user_id = auth.uid()
    )
  );

-- UPDATE: Confirmed room members can edit notes, whiteboard, and lecture sync
CREATE POLICY "Members can update collaborative notes"
  ON public.collaborative_notes FOR UPDATE
  TO authenticated
  USING (public.is_room_member(room_id, auth.uid()))
  WITH CHECK (public.is_room_member(room_id, auth.uid()));

-- DELETE: Only room host can delete room notes
CREATE POLICY "Hosts can delete collaborative notes"
  ON public.collaborative_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_rooms
      WHERE id = room_id AND user_id = auth.uid()
    )
  );

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
