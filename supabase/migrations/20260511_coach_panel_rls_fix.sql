-- ============================================================================
-- HoopConnect — Coach panel RLS recursion fix (v2)
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- v1 used LANGUAGE sql for the helpers. Postgres inlines simple SQL functions
-- when it sees an opportunity, and inlining bypasses SECURITY DEFINER — so the
-- helper effectively ran as the caller and re-triggered RLS, restoring the
-- original recursion. Switching to LANGUAGE plpgsql blocks inlining; the
-- function is always invoked as the owner (which has BYPASSRLS on Supabase).
-- ============================================================================

-- ─── Helper: current user owns this team? ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_coach(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.teams
     WHERE id = p_team_id
       AND coach_id = auth.uid()
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.is_team_coach(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_team_coach(UUID) TO authenticated;


-- ─── Helper: current user is a confirmed member of this team? ─────────────
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
     WHERE team_id = p_team_id
       AND player_id = auth.uid()
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.is_team_member(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;


-- ============================================================================
-- POLICIES — drop ALL legacy variants then recreate using the plpgsql helpers
-- ============================================================================

-- ─── teams ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach owns teams"  ON public.teams;
DROP POLICY IF EXISTS "members read team" ON public.teams;

CREATE POLICY "coach owns teams"
  ON public.teams FOR ALL
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());

CREATE POLICY "members read team"
  ON public.teams FOR SELECT
  USING (public.is_team_member(id));


-- ─── team_members ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach manages team members" ON public.team_members;
DROP POLICY IF EXISTS "player reads own membership" ON public.team_members;

CREATE POLICY "coach manages team members"
  ON public.team_members FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));

CREATE POLICY "player reads own membership"
  ON public.team_members FOR SELECT
  USING (player_id = auth.uid());


-- ─── team_invites ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach manages team invites"     ON public.team_invites;
DROP POLICY IF EXISTS "player reads own invites"       ON public.team_invites;
DROP POLICY IF EXISTS "player updates own invite response" ON public.team_invites;

CREATE POLICY "coach manages team invites"
  ON public.team_invites FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));

CREATE POLICY "player reads own invites"
  ON public.team_invites FOR SELECT
  USING (lower(invited_email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "player updates own invite response"
  ON public.team_invites FOR UPDATE
  USING (lower(invited_email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid()));


-- ─── notifications: coach-side INSERT policy ───────────────────────────────
DROP POLICY IF EXISTS "coach creates notif for players" ON public.notifications;
CREATE POLICY "coach creates notif for players"
  ON public.notifications FOR INSERT WITH CHECK (
    type = 'team_invite'
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.player_id = notifications.user_id
        AND public.is_team_coach(tm.team_id)
    )
  );
