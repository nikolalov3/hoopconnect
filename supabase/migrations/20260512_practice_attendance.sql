-- ============================================================================
-- HoopConnect — Practice attendance (frekwencja na treningach drużynowych)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.practice_attendance (
  practice_id  UUID NOT NULL REFERENCES public.team_practice(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('present','late','absent')),
  notes        TEXT,
  marked_by    UUID REFERENCES public.coach_profiles(id),
  marked_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (practice_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_player
  ON public.practice_attendance(player_id);

ALTER TABLE public.practice_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach manages practice attendance" ON public.practice_attendance;
CREATE POLICY "coach manages practice attendance"
  ON public.practice_attendance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.team_practice tp
     WHERE tp.id = practice_attendance.practice_id
       AND public.is_team_coach(tp.team_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_practice tp
     WHERE tp.id = practice_attendance.practice_id
       AND public.is_team_coach(tp.team_id)
  ));

DROP POLICY IF EXISTS "player reads own attendance" ON public.practice_attendance;
CREATE POLICY "player reads own attendance"
  ON public.practice_attendance FOR SELECT
  USING (player_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_attendance;


CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_practice_id UUID, p_player_id UUID, p_status TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_team_id UUID;
BEGIN
  SELECT team_id INTO v_team_id FROM public.team_practice WHERE id = p_practice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'practice not found'; END IF;
  IF NOT public.is_team_coach(v_team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  IF p_status IS NULL THEN
    DELETE FROM public.practice_attendance
     WHERE practice_id = p_practice_id AND player_id = p_player_id;
  ELSE
    IF p_status NOT IN ('present','late','absent') THEN
      RAISE EXCEPTION 'invalid status: %', p_status;
    END IF;
    INSERT INTO public.practice_attendance (practice_id, player_id, status, marked_by)
    VALUES (p_practice_id, p_player_id, p_status, auth.uid())
    ON CONFLICT (practice_id, player_id) DO UPDATE
      SET status    = EXCLUDED.status,
          marked_by = EXCLUDED.marked_by,
          marked_at = NOW();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_attendance(UUID,UUID,TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_attendance(UUID,UUID,TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_practice_attendance(p_practice_id UUID)
RETURNS TABLE (
  player_id           UUID,
  display_first_name  TEXT,
  display_last_name   TEXT,
  jersey_number       INT,
  player_email        TEXT,
  status              TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_team_id UUID;
BEGIN
  SELECT team_id INTO v_team_id FROM public.team_practice WHERE id = p_practice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'practice not found'; END IF;
  IF NOT public.is_team_coach(v_team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    tm.player_id, tm.display_first_name, tm.display_last_name,
    tm.jersey_number, u.email::TEXT, pa.status::TEXT
  FROM public.team_members tm
  JOIN auth.users u ON u.id = tm.player_id
  LEFT JOIN public.practice_attendance pa
    ON pa.practice_id = p_practice_id AND pa.player_id = tm.player_id
  WHERE tm.team_id = v_team_id
  ORDER BY tm.joined_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_practice_attendance(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_practice_attendance(UUID) TO authenticated;


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
    SELECT id, scheduled_at FROM public.team_practice
     WHERE team_id = p_team_id AND scheduled_at < NOW()
     ORDER BY scheduled_at DESC
     LIMIT p_limit
  ),
  roster AS (
    SELECT tm.player_id FROM public.team_members tm WHERE tm.team_id = p_team_id
  )
  SELECT r.player_id, rec.id, rec.scheduled_at, pa.status::TEXT
    FROM roster r
    CROSS JOIN recent rec
    LEFT JOIN public.practice_attendance pa
      ON pa.player_id = r.player_id AND pa.practice_id = rec.id
   ORDER BY rec.scheduled_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_team_attendance_recent(UUID,INT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_attendance_recent(UUID,INT) TO authenticated;
