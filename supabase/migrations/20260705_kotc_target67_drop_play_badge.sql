-- ============================================================================
-- KotC: target 90 -> 67 pkt (default) + usuniecie badge za sam udzial
--
-- 1) kotc_create_session: domyslny p_target 90 -> 67
-- 2) kotc_sessions.target: DEFAULT 90 -> 67 (dla zgodnosci z RPC)
-- 3) kotc_play_july: is_active=false (soft-delete, jak przy Rollerze —
--    nie hard-delete, zeby nie zostawic sierot u graczy ktorzy juz go maja)
-- 4) kotc_award_xp: REPLACE bez insertu kotc_play_july — od teraz trigger
--    na koniec sesji przyznaje TYLKO XP + kotc_win_july zwyciezcom, zero
--    wpisow za sam udzial (zamiast tylko chowac w katalogu, zeby nie zapychac
--    user_achievements bezuzytecznymi wierszami co sesje).
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1)
CREATE OR REPLACE FUNCTION public.kotc_create_session(
  p_target          INT DEFAULT 67,
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

-- 2)
ALTER TABLE public.kotc_sessions ALTER COLUMN target SET DEFAULT 67;

-- 3)
UPDATE public.achievements_catalog SET is_active = false WHERE id = 'kotc_play_july';

-- 4)
CREATE OR REPLACE FUNCTION public.kotc_award_xp(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_s public.kotc_sessions; v_cap INT := 500; r RECORD; v_amt INT; v_today INT;
BEGIN
  SELECT * INTO v_s FROM public.kotc_sessions WHERE id = p_session_id;
  IF v_s.id IS NULL OR v_s.status <> 'finished' OR v_s.xp_awarded THEN RETURN; END IF;
  FOR r IN
    SELECT DISTINCT m.user_id AS uid, st.team_id, st.score
    FROM public.kotc_session_teams st
    JOIN public.club_members m ON m.club_id = st.team_id
    WHERE st.session_id = p_session_id AND m.user_id IS NOT NULL
  LOOP
    -- XP
    v_amt := 75;
    IF r.team_id = v_s.winner_team_id THEN v_amt := v_amt + 200; END IF;
    IF r.score >= 50 THEN v_amt := v_amt + 100; END IF;
    SELECT coalesce(sum(amount), 0) INTO v_today
      FROM public.kotc_xp_log WHERE user_id = r.uid AND created_at::date = current_date;
    v_amt := GREATEST(0, LEAST(v_amt, v_cap - v_today));
    IF v_amt > 0 THEN
      PERFORM public.add_player_xp(r.uid, v_amt);
      INSERT INTO public.kotc_xp_log(user_id, session_id, amount) VALUES (r.uid, p_session_id, v_amt);
    END IF;

    -- osiagniecia — TYLKO zwyciezca (kotc_play_july za sam udzial: usuniete)
    IF r.team_id = v_s.winner_team_id THEN
      INSERT INTO public.user_achievements(user_id, achievement_id, base_id)
      VALUES (r.uid, 'kotc_win_july:' || p_session_id, 'kotc_win_july');
    END IF;
  END LOOP;
  UPDATE public.kotc_sessions SET xp_awarded = true WHERE id = p_session_id;
END $$;
