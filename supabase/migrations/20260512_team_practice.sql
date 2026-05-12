-- ============================================================================
-- HoopConnect — Team practice schedule
-- Trener planuje treningi drużynowe (data + godzina + opcjonalna kategoria).
-- Gracz widzi je w głównej sesji aplikacji.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_practice (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_min  INT DEFAULT 90,
  category      TEXT,
  location      TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES public.coach_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_practice_team_date
  ON public.team_practice(team_id, scheduled_at);

ALTER TABLE public.team_practice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach manages team practice" ON public.team_practice;
CREATE POLICY "coach manages team practice"
  ON public.team_practice FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));

DROP POLICY IF EXISTS "member reads team practice" ON public.team_practice;
CREATE POLICY "member reads team practice"
  ON public.team_practice FOR SELECT
  USING (public.is_team_member(team_id));

CREATE OR REPLACE FUNCTION public.tg_team_practice_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_practice_updated_at ON public.team_practice;
CREATE TRIGGER team_practice_updated_at
  BEFORE UPDATE ON public.team_practice
  FOR EACH ROW EXECUTE FUNCTION public.tg_team_practice_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_practice;


CREATE OR REPLACE FUNCTION public.get_my_practice(
  p_from TIMESTAMPTZ, p_to TIMESTAMPTZ
) RETURNS TABLE (
  practice_id   UUID,
  team_id       UUID,
  team_name     TEXT,
  team_color    TEXT,
  scheduled_at  TIMESTAMPTZ,
  duration_min  INT,
  category      TEXT,
  location      TEXT,
  notes         TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    tp.id, t.id, t.name::TEXT, t.primary_color::TEXT,
    tp.scheduled_at, tp.duration_min,
    tp.category::TEXT, tp.location::TEXT, tp.notes::TEXT
  FROM public.team_practice tp
  JOIN public.team_members tm ON tm.team_id = tp.team_id
  JOIN public.teams t          ON t.id = tp.team_id
  WHERE tm.player_id = auth.uid()
    AND tp.scheduled_at >= p_from
    AND tp.scheduled_at <  p_to
    AND t.archived_at IS NULL
  ORDER BY tp.scheduled_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_practice(TIMESTAMPTZ, TIMESTAMPTZ) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_practice(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
