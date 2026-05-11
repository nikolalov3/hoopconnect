-- ============================================================================
-- HoopConnect — Coach panel RLS recursion fix
-- Run in Supabase SQL Editor AFTER 20260511_coach_panel.sql
-- (idempotent — safe to re-run)
--
-- The original policies on `teams` and `team_members` referenced each other
-- via subqueries. RLS subqueries run with RLS active by default, so:
--   teams.SELECT → checks "members read team"
--                → subquery to team_members
--                → triggers team_members RLS
--                → "coach manages team members" subquery to teams
--                → recursion.
--
-- Fix: wrap the cross-table existence checks in SECURITY DEFINER functions
-- that bypass RLS internally.
-- ============================================================================

-- ─── Helper: is the current user the coach who owns this team? ──────────────
CREATE OR REPLACE FUNCTION public.is_team_coach(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
     WHERE id = p_team_id
       AND coach_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_team_coach(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_team_coach(UUID) TO authenticated;


-- ─── Helper: is the current user a confirmed member of this team? ──────────
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
     WHERE team_id = p_team_id
       AND player_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_team_member(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;


-- ============================================================================
-- REPLACE POLICIES — using the helper functions
-- ============================================================================

-- ─── teams ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach owns teams" ON public.teams;
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
DROP POLICY IF EXISTS "coach manages team invites" ON public.team_invites;
CREATE POLICY "coach manages team invites"
  ON public.team_invites FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));


-- ─── notifications: coach-side INSERT policy ───────────────────────────────
-- Coach can insert team_invite notifications targeted at any player profile,
-- and coach_message / team_practice only at confirmed roster members.
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
