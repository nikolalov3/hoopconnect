-- ============================================================================
-- HoopConnect — fix get_team_attendance_recent ambiguous column reference
-- 'column reference "scheduled_at" is ambiguous'
--
-- RETURNS TABLE declares an OUT parameter named scheduled_at; the CTE body
-- also referenced team_practice.scheduled_at unqualified, so Postgres
-- couldn't tell which was meant in the WHERE / ORDER BY clauses.
-- Fix: alias CTE columns to unique names (prc_at, prc_id, plr_id) and
-- prefix every reference. The outer SELECT then maps positionally to the
-- RETURNS TABLE columns.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_team_attendance_recent(
  p_team_id UUID, p_limit INT DEFAULT 10
) RETURNS TABLE (
  player_id     UUID,
  practice_id   UUID,
  scheduled_at  TIMESTAMPTZ,
  status        TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_team_coach(p_team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT tp.id AS prc_id, tp.scheduled_at AS prc_at
    FROM public.team_practice tp
    WHERE tp.team_id = p_team_id
      AND tp.scheduled_at < NOW()
    ORDER BY tp.scheduled_at DESC
    LIMIT p_limit
  ),
  roster AS (
    SELECT tm.player_id AS plr_id
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
  )
  SELECT
    r.plr_id,
    rec.prc_id,
    rec.prc_at,
    pa.status::TEXT
  FROM roster r
  CROSS JOIN recent rec
  LEFT JOIN public.practice_attendance pa
    ON pa.player_id = r.plr_id AND pa.practice_id = rec.prc_id
  ORDER BY rec.prc_at DESC;
END;
$$;
