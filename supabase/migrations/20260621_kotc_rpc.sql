-- ============================================================================
-- King of the Court — RPC (część 1): create / join / start
-- SECURITY DEFINER — logika serwerowa (anty-cheat). Run AFTER 20260621_kotc.sql.
-- Następne: kotc_cast_vote (+ silnik/confirm), award XP, kotc_vote_mvp.
-- ============================================================================

-- ─── kotc_create_session — host tworzy sesję + kod ──────────────────────────
CREATE OR REPLACE FUNCTION public.kotc_create_session(
  p_target          INT DEFAULT 90,
  p_rotate_after    INT DEFAULT 3,
  p_win_pts         INT DEFAULT 15,
  p_streak3_bonus   INT DEFAULT 5,
  p_min_teams       INT DEFAULT 4,
  p_max_teams       INT DEFAULT 6,
  p_confirm_votes   INT DEFAULT 6,
  p_vote_cooldown_sec INT DEFAULT 150
) RETURNS public.kotc_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_session public.kotc_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.kotc_sessions(
    code, host_id, target, rotate_after, win_pts, streak3_bonus,
    min_teams, max_teams, confirm_votes, vote_cooldown_sec
  ) VALUES (
    public.kotc_gen_code(), auth.uid(), p_target, p_rotate_after, p_win_pts, p_streak3_bonus,
    p_min_teams, p_max_teams, p_confirm_votes, p_vote_cooldown_sec
  ) RETURNING * INTO v_session;
  RETURN v_session;
END $$;

-- ─── kotc_join — drużyna dołącza kodem (walidacja ≥3 graczy, limit) ──────────
CREATE OR REPLACE FUNCTION public.kotc_join(p_code TEXT, p_team_id UUID)
RETURNS public.kotc_session_teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.kotc_sessions;
  v_count   INT;
  v_roster  INT;
  v_pos     INT;
  v_row     public.kotc_session_teams;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_session FROM public.kotc_sessions WHERE code = upper(p_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono sesji o tym kodzie'; END IF;
  IF v_session.status <> 'lobby' THEN RAISE EXCEPTION 'Sesja już wystartowała'; END IF;

  -- autoryzacja: caller jest trenerem drużyny LUB jej zawodnikiem
  IF NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.coach_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = p_team_id AND m.player_id = auth.uid())
  THEN RAISE EXCEPTION 'Brak uprawnień do tej drużyny'; END IF;

  -- min. 3 graczy w składzie (3v3)
  SELECT count(*) INTO v_roster FROM public.team_members WHERE team_id = p_team_id;
  IF v_roster < 3 THEN RAISE EXCEPTION 'Drużyna musi mieć min. 3 graczy (ma %)', v_roster; END IF;

  -- limit drużyn w sesji
  SELECT count(*) INTO v_count FROM public.kotc_session_teams WHERE session_id = v_session.id;
  IF v_count >= v_session.max_teams THEN RAISE EXCEPTION 'Sesja pełna (max % drużyn)', v_session.max_teams; END IF;

  SELECT coalesce(max(queue_pos), -1) + 1 INTO v_pos
    FROM public.kotc_session_teams WHERE session_id = v_session.id;

  INSERT INTO public.kotc_session_teams(session_id, team_id, queue_pos)
  VALUES (v_session.id, p_team_id, v_pos)
  ON CONFLICT (session_id, team_id) DO NOTHING
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ta drużyna już jest w sesji'; END IF;

  RETURN v_row;
END $$;

-- ─── kotc_start — host startuje (lobby → live, pierwsza para) ────────────────
CREATE OR REPLACE FUNCTION public.kotc_start(p_session_id UUID)
RETURNS public.kotc_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_session public.kotc_sessions; v_count INT; v_queue UUID[];
BEGIN
  SELECT * INTO v_session FROM public.kotc_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesja nie znaleziona'; END IF;
  IF v_session.host_id <> auth.uid() THEN RAISE EXCEPTION 'Tylko host może wystartować'; END IF;
  IF v_session.status <> 'lobby' THEN RAISE EXCEPTION 'Sesja już wystartowała'; END IF;

  SELECT count(*) INTO v_count FROM public.kotc_session_teams WHERE session_id = p_session_id;
  IF v_count < v_session.min_teams THEN
    RAISE EXCEPTION 'Potrzeba min. % drużyn (jest %)', v_session.min_teams, v_count;
  END IF;

  -- kolejka = wszystkie drużyny wg kolejności dołączenia (1:1 z engine.js)
  SELECT array_agg(team_id ORDER BY queue_pos) INTO v_queue
    FROM public.kotc_session_teams WHERE session_id = p_session_id;

  UPDATE public.kotc_sessions
    SET status = 'live', king_team_id = NULL, streak = 0, queue = v_queue, last_confirmed_at = now()
    WHERE id = p_session_id
    RETURNING * INTO v_session;

  -- pierwsza para = queue[1], queue[2]
  INSERT INTO public.kotc_games(session_id, team_a, team_b, status)
  VALUES (p_session_id, v_queue[1], v_queue[2], 'voting');

  RETURN v_session;
END $$;

-- ─── uprawnienia ────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.kotc_create_session(INT,INT,INT,INT,INT,INT,INT,INT) FROM public;
REVOKE ALL ON FUNCTION public.kotc_join(TEXT,UUID) FROM public;
REVOKE ALL ON FUNCTION public.kotc_start(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.kotc_create_session(INT,INT,INT,INT,INT,INT,INT,INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kotc_join(TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kotc_start(UUID) TO authenticated;
