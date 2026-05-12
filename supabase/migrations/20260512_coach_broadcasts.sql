-- ============================================================================
-- HoopConnect — Coach broadcasts (powiadomienia od trenera do drużyny)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_broadcasts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_id              UUID NOT NULL REFERENCES public.coach_profiles(id),
  title                 TEXT,
  body                  TEXT NOT NULL,
  recipient_player_ids  UUID[],
  recipient_count       INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_broadcasts_team
  ON public.coach_broadcasts(team_id, created_at DESC);

ALTER TABLE public.coach_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach manages own broadcasts" ON public.coach_broadcasts;
CREATE POLICY "coach manages own broadcasts"
  ON public.coach_broadcasts FOR ALL
  USING       (public.is_team_coach(team_id))
  WITH CHECK  (public.is_team_coach(team_id));


CREATE OR REPLACE FUNCTION public.send_coach_broadcast(
  p_team_id UUID, p_title TEXT, p_body TEXT, p_player_ids UUID[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_broadcast_id UUID;
  v_coach_name   TEXT;
  v_team_name    TEXT;
  v_target_ids   UUID[];
  v_count        INT;
BEGIN
  IF NOT public.is_team_coach(p_team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'body required'; END IF;

  SELECT full_name INTO v_coach_name FROM public.coach_profiles WHERE id = auth.uid();
  SELECT name      INTO v_team_name  FROM public.teams         WHERE id = p_team_id;

  IF p_player_ids IS NULL OR array_length(p_player_ids, 1) IS NULL THEN
    SELECT array_agg(player_id) INTO v_target_ids
      FROM public.team_members WHERE team_id = p_team_id;
  ELSE
    SELECT array_agg(tm.player_id) INTO v_target_ids
      FROM public.team_members tm
      WHERE tm.team_id = p_team_id AND tm.player_id = ANY(p_player_ids);
  END IF;

  v_count := COALESCE(array_length(v_target_ids, 1), 0);
  IF v_count = 0 THEN RAISE EXCEPTION 'no recipients'; END IF;

  INSERT INTO public.coach_broadcasts (team_id, coach_id, title, body, recipient_player_ids, recipient_count)
  VALUES (p_team_id, auth.uid(), NULLIF(trim(p_title),''), trim(p_body), v_target_ids, v_count)
  RETURNING id INTO v_broadcast_id;

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT unnest(v_target_ids), 'coach_message',
    jsonb_build_object(
      'broadcast_id', v_broadcast_id,
      'team_id',      p_team_id,
      'team_name',    v_team_name,
      'coach_name',   v_coach_name,
      'title',        NULLIF(trim(p_title),''),
      'body',         trim(p_body)
    );

  RETURN jsonb_build_object('broadcast_id', v_broadcast_id, 'recipient_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.send_coach_broadcast(UUID,TEXT,TEXT,UUID[]) FROM public;
GRANT EXECUTE ON FUNCTION public.send_coach_broadcast(UUID,TEXT,TEXT,UUID[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.revoke_coach_broadcast(p_broadcast_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_team_id UUID;
BEGIN
  SELECT team_id INTO v_team_id FROM public.coach_broadcasts WHERE id = p_broadcast_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'broadcast not found'; END IF;
  IF NOT public.is_team_coach(v_team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE public.coach_broadcasts SET revoked_at = NOW() WHERE id = p_broadcast_id;
  DELETE FROM public.notifications
   WHERE type = 'coach_message'
     AND payload->>'broadcast_id' = p_broadcast_id::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_coach_broadcast(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_coach_broadcast(UUID) TO authenticated;
