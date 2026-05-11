-- ============================================================================
-- HoopConnect — Player-side RPCs for team membership
-- Run in Supabase SQL Editor (idempotent).
--
-- Players cannot SELECT teams directly (the recursion-fix migration dropped
-- the "members read team" policy). To still let the player see *their* teams
-- in the settings panel, we expose a SECURITY DEFINER RPC that joins
-- team_members + teams server-side and returns just the rows for the caller.
--
-- We also expose leave_team() so a player can remove themselves from a roster
-- without needing a DELETE policy on team_members.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_teams()
RETURNS TABLE (
  team_id              UUID,
  team_name            TEXT,
  organization         TEXT,
  age_category         TEXT,
  section              TEXT,
  primary_color        TEXT,
  display_first_name   TEXT,
  display_last_name    TEXT,
  jersey_number        INT,
  joined_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.name, t.organization, t.age_category, t.section, t.primary_color,
    tm.display_first_name, tm.display_last_name, tm.jersey_number, tm.joined_at
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.player_id = auth.uid()
    AND t.archived_at IS NULL
  ORDER BY tm.joined_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_teams() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_teams() TO authenticated;


CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.team_members
   WHERE team_id = p_team_id
     AND player_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.leave_team(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.leave_team(UUID) TO authenticated;
