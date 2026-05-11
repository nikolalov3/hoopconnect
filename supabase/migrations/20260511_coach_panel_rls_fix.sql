-- ============================================================================
-- HoopConnect — Coach panel RLS recursion fix (v3, definitive)
-- Run in Supabase SQL Editor. Idempotent — safe to re-run as many times as you want.
--
-- Approach v3:
--   v1 used LANGUAGE sql helpers (got inlined, lost SECURITY DEFINER → recursion)
--   v2 used LANGUAGE plpgsql helpers (should bypass RLS, but the error persisted
--                                     in the user's env — hard to diagnose remotely)
--
--   v3: stop relying on SECURITY DEFINER for the policy graph at all.
--       Drop the one cross-policy reference that creates the cycle
--       ("members read team" queries team_members, whose policy queries teams).
--
--       teams will be readable only by its coach for now.
--       Player UI doesn't directly read teams yet — the invite payload carries
--       team_name, and accepted membership is read via team_members (player_id).
--       When player UI needs team details later, we'll add a SECURITY DEFINER
--       RPC `get_my_teams()` instead of opening up SELECT.
--
--       Helpers are still useful for non-recursive paths
--       (e.g. coach managing team_invites, coach inserting notifications)
--       so they stay, in plpgsql form.
-- ============================================================================

-- ─── 1. Drop EVERY coach-panel policy first (clean slate) ──────────────────
DROP POLICY IF EXISTS "coach owns teams"               ON public.teams;
DROP POLICY IF EXISTS "members read team"              ON public.teams;

DROP POLICY IF EXISTS "coach manages team members"     ON public.team_members;
DROP POLICY IF EXISTS "player reads own membership"    ON public.team_members;

DROP POLICY IF EXISTS "coach manages team invites"     ON public.team_invites;
DROP POLICY IF EXISTS "player reads own invites"       ON public.team_invites;
DROP POLICY IF EXISTS "player updates own invite response" ON public.team_invites;

DROP POLICY IF EXISTS "user reads own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "user marks own notifications read" ON public.notifications;
DROP POLICY IF EXISTS "coach creates notif for players" ON public.notifications;


-- ─── 2. (Re)create plpgsql helpers — plpgsql so Postgres can't inline them ─
CREATE OR REPLACE FUNCTION public.is_team_coach(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result BOOLEAN;
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


CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result BOOLEAN;
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


-- ─── 3. teams ── ONLY coach access. No cross-policy queries → no recursion.
CREATE POLICY "coach owns teams"
  ON public.teams FOR ALL
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());


-- ─── 4. team_members ──────────────────────────────────────────────────────
CREATE POLICY "coach manages team members"
  ON public.team_members FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));

CREATE POLICY "player reads own membership"
  ON public.team_members FOR SELECT
  USING (player_id = auth.uid());


-- ─── 5. team_invites ──────────────────────────────────────────────────────
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


-- ─── 6. notifications ─────────────────────────────────────────────────────
CREATE POLICY "user reads own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user marks own notifications read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "coach creates notif for players"
  ON public.notifications FOR INSERT WITH CHECK (
    type = 'team_invite'
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.player_id = notifications.user_id
        AND public.is_team_coach(tm.team_id)
    )
  );
