-- ============================================================================
-- HoopConnect — Coach RPC: get_team_roster
-- Returns the team's roster with each player's email so the coach UI can fall
-- back to the email's local part as a label when the coach hasn't typed a name.
-- Run in Supabase SQL Editor (idempotent).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_team_roster(p_team_id UUID)
RETURNS TABLE (
  player_id           UUID,
  display_first_name  TEXT,
  display_last_name   TEXT,
  jersey_number       INT,
  joined_at           TIMESTAMPTZ,
  player_email        TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_team_coach(p_team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;
  RETURN QUERY
  SELECT
    tm.player_id,
    tm.display_first_name,
    tm.display_last_name,
    tm.jersey_number,
    tm.joined_at,
    u.email AS player_email
  FROM public.team_members tm
  JOIN auth.users u ON u.id = tm.player_id
  WHERE tm.team_id = p_team_id
  ORDER BY tm.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_roster(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_roster(UUID) TO authenticated;
