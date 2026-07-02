-- ============================================================================
-- King of the Court — RPC (część 2): kotc_cast_vote + krok silnika
-- Głos uczestnika → gdy `confirm_votes` na drużynę → potwierdź wynik i przesuń
-- silnik (1:1 z src/features/kotc/engine.js). Cooldown 2:30 po każdym potwierdzeniu.
-- Run AFTER 20260621_kotc.sql i _rpc.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kotc_cast_vote(p_game_id UUID, p_voted_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_game    public.kotc_games;
  v_s       public.kotc_sessions;
  v_votes   INT;
  v_winner  UUID;
  v_loser   UUID;
  v_king    UUID;
  v_streak  INT;
  v_queue   UUID[];
  v_chall   UUID;
  v_pts     INT;
  v_leader_score INT;
  v_winner_team  UUID;
  v_na UUID; v_nb UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_game FROM public.kotc_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gierka nie znaleziona'; END IF;
  IF v_game.status <> 'voting' THEN RAISE EXCEPTION 'Głosowanie na tę gierkę jest zamknięte'; END IF;

  SELECT * INTO v_s FROM public.kotc_sessions WHERE id = v_game.session_id;

  -- tylko uczestnik sesji (profil w składzie którejś drużyny w sesji)
  IF NOT EXISTS (
    SELECT 1 FROM public.kotc_session_teams st
    JOIN public.team_members m ON m.team_id = st.team_id
    WHERE st.session_id = v_s.id AND m.player_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Tylko uczestnicy sesji mogą głosować'; END IF;

  -- cooldown 2:30 od ostatniego potwierdzenia
  IF v_s.last_confirmed_at IS NOT NULL
     AND now() < v_s.last_confirmed_at + make_interval(secs => v_s.vote_cooldown_sec) THEN
    RAISE EXCEPTION 'Głosowanie odblokuje się po %s s od ostatniej zmiany', v_s.vote_cooldown_sec;
  END IF;

  IF p_voted_team_id NOT IN (v_game.team_a, v_game.team_b) THEN
    RAISE EXCEPTION 'Można głosować tylko na drużynę z tej gierki';
  END IF;

  -- oddaj/zmień głos
  INSERT INTO public.kotc_game_votes(game_id, voter_id, voted_team_id)
  VALUES (p_game_id, auth.uid(), p_voted_team_id)
  ON CONFLICT (game_id, voter_id)
  DO UPDATE SET voted_team_id = EXCLUDED.voted_team_id, created_at = now();

  -- ile głosów na tę drużynę?
  SELECT count(*) INTO v_votes
    FROM public.kotc_game_votes WHERE game_id = p_game_id AND voted_team_id = p_voted_team_id;

  IF v_votes < v_s.confirm_votes THEN
    RETURN jsonb_build_object('status','voting','votes',v_votes,'needed',v_s.confirm_votes);
  END IF;

  -- ── PRÓG OSIĄGNIĘTY → POTWIERDŹ + KROK SILNIKA (port engine.recordWin) ──
  v_winner := p_voted_team_id;
  v_loser  := CASE WHEN v_game.team_a = v_winner THEN v_game.team_b ELSE v_game.team_a END;
  v_king   := v_s.king_team_id;
  v_streak := v_s.streak;
  v_queue  := v_s.queue;

  IF v_king IS NULL THEN
    -- świeża para: zdejmij obie z kolejki, winner → król
    v_queue := array_remove(array_remove(v_queue, v_winner), v_loser);
    UPDATE public.kotc_session_teams
      SET score = score + v_s.win_pts, wins = wins + 1, best_streak = GREATEST(best_streak, 1)
      WHERE session_id = v_s.id AND team_id = v_winner;
    v_king := v_winner; v_streak := 1;
    v_queue := v_queue || v_loser;                       -- przegrany na koniec
  ELSE
    v_chall := v_queue[1];                               -- challenger = przód kolejki
    v_queue := v_queue[2:];                              -- zdejmij z przodu
    IF v_winner = v_king THEN
      v_streak := v_streak + 1;
      v_pts := v_s.win_pts + CASE WHEN v_streak = v_s.rotate_after THEN v_s.streak3_bonus ELSE 0 END;
      UPDATE public.kotc_session_teams
        SET score = score + v_pts, wins = wins + 1, best_streak = GREATEST(best_streak, v_streak)
        WHERE session_id = v_s.id AND team_id = v_king;
      v_queue := v_queue || v_chall;                     -- przegrany (challenger) na koniec
      IF v_streak >= v_s.rotate_after THEN
        v_queue := v_queue || v_king;                    -- król oddaje koronę
        v_king := NULL; v_streak := 0;
      END IF;
    ELSE
      -- challenger obala króla
      UPDATE public.kotc_session_teams
        SET score = score + v_s.win_pts, wins = wins + 1, best_streak = GREATEST(best_streak, 1)
        WHERE session_id = v_s.id AND team_id = v_winner;
      v_queue := v_queue || v_king;                      -- stary król na koniec
      v_king := v_winner; v_streak := 1;
    END IF;
  END IF;

  -- zamknij gierkę
  UPDATE public.kotc_games
    SET status = 'confirmed', winner_team_id = v_winner, confirmed_at = now()
    WHERE id = p_game_id;

  -- zapisz stan + cooldown
  UPDATE public.kotc_sessions
    SET king_team_id = v_king, streak = v_streak, queue = v_queue, last_confirmed_at = now()
    WHERE id = v_s.id;

  -- cel osiągnięty?
  SELECT max(score) INTO v_leader_score FROM public.kotc_session_teams WHERE session_id = v_s.id;
  IF v_leader_score >= v_s.target THEN
    SELECT team_id INTO v_winner_team FROM public.kotc_session_teams
      WHERE session_id = v_s.id ORDER BY score DESC, wins DESC LIMIT 1;
    UPDATE public.kotc_sessions
      SET status = 'finished', winner_team_id = v_winner_team, ended_at = now()
      WHERE id = v_s.id;
    -- TODO (część 3): kotc_award_xp(v_s.id) — rozdanie XP uczestnikom
    RETURN jsonb_build_object('status','finished','winner_team',v_winner_team);
  END IF;

  -- kolejna gierka wg nowego stanu (onCourt)
  IF v_king IS NULL THEN v_na := v_queue[1]; v_nb := v_queue[2];
  ELSE v_na := v_king; v_nb := v_queue[1]; END IF;
  INSERT INTO public.kotc_games(session_id, team_a, team_b, status)
  VALUES (v_s.id, v_na, v_nb, 'voting');

  RETURN jsonb_build_object('status','confirmed','winner',v_winner,'next_game',jsonb_build_array(v_na,v_nb));
END $$;

REVOKE ALL ON FUNCTION public.kotc_cast_vote(UUID,UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.kotc_cast_vote(UUID,UUID) TO authenticated;
