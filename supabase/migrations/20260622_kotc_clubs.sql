-- ============================================================================
-- King of the Court — przepięcie z `teams` na `clubs` (kluby graczy z hex+skrót)
-- Kolumny zostają (team_id/team_a/…), ale wskazują teraz na public.clubs.
-- Członkostwo/roster liczone z club_members (user_id ≠ null = obsadzony slot).
-- Run AFTER wszystkich 20260621_kotc*.sql. Tabele są puste, więc bezpieczne.
-- ============================================================================

-- ─── 1. Przepnij FK: teams → clubs ──────────────────────────────────────────
ALTER TABLE public.kotc_session_teams DROP CONSTRAINT IF EXISTS kotc_session_teams_team_id_fkey;
ALTER TABLE public.kotc_session_teams ADD  CONSTRAINT kotc_session_teams_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE public.kotc_games DROP CONSTRAINT IF EXISTS kotc_games_team_a_fkey;
ALTER TABLE public.kotc_games ADD  CONSTRAINT kotc_games_team_a_fkey FOREIGN KEY (team_a) REFERENCES public.clubs(id);
ALTER TABLE public.kotc_games DROP CONSTRAINT IF EXISTS kotc_games_team_b_fkey;
ALTER TABLE public.kotc_games ADD  CONSTRAINT kotc_games_team_b_fkey FOREIGN KEY (team_b) REFERENCES public.clubs(id);
ALTER TABLE public.kotc_games DROP CONSTRAINT IF EXISTS kotc_games_winner_team_id_fkey;
ALTER TABLE public.kotc_games ADD  CONSTRAINT kotc_games_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.clubs(id);

ALTER TABLE public.kotc_sessions DROP CONSTRAINT IF EXISTS kotc_sessions_king_team_id_fkey;
ALTER TABLE public.kotc_sessions ADD  CONSTRAINT kotc_sessions_king_team_id_fkey FOREIGN KEY (king_team_id) REFERENCES public.clubs(id);
ALTER TABLE public.kotc_sessions DROP CONSTRAINT IF EXISTS kotc_sessions_winner_team_id_fkey;
ALTER TABLE public.kotc_sessions ADD  CONSTRAINT kotc_sessions_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.clubs(id);

ALTER TABLE public.kotc_game_votes DROP CONSTRAINT IF EXISTS kotc_game_votes_voted_team_id_fkey;
ALTER TABLE public.kotc_game_votes ADD  CONSTRAINT kotc_game_votes_voted_team_id_fkey FOREIGN KEY (voted_team_id) REFERENCES public.clubs(id);

-- ─── 2. kotc_join — klub dołącza (walidacja ≥3 obsadzonych slotów) ───────────
CREATE OR REPLACE FUNCTION public.kotc_join(p_code TEXT, p_team_id UUID)
RETURNS public.kotc_session_teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_session public.kotc_sessions; v_count INT; v_roster INT; v_pos INT; v_row public.kotc_session_teams;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_session FROM public.kotc_sessions WHERE code = upper(p_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Nie znaleziono sesji o tym kodzie'; END IF;
  IF v_session.status <> 'lobby' THEN RAISE EXCEPTION 'Sesja już wystartowała'; END IF;

  -- właściciel klubu LUB członek
  IF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = p_team_id AND c.owner_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = p_team_id AND m.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Brak uprawnień do tego klubu'; END IF;

  -- min. 3 obsadzonych slotów (3v3)
  SELECT count(*) INTO v_roster FROM public.club_members WHERE club_id = p_team_id AND user_id IS NOT NULL;
  IF v_roster < 3 THEN RAISE EXCEPTION 'Klub musi mieć min. 3 graczy (ma %)', v_roster; END IF;

  SELECT count(*) INTO v_count FROM public.kotc_session_teams WHERE session_id = v_session.id;
  IF v_count >= v_session.max_teams THEN RAISE EXCEPTION 'Sesja pełna (max % drużyn)', v_session.max_teams; END IF;

  SELECT coalesce(max(queue_pos), -1) + 1 INTO v_pos FROM public.kotc_session_teams WHERE session_id = v_session.id;
  INSERT INTO public.kotc_session_teams(session_id, team_id, queue_pos)
  VALUES (v_session.id, p_team_id, v_pos)
  ON CONFLICT (session_id, team_id) DO NOTHING RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ten klub już jest w sesji'; END IF;
  RETURN v_row;
END $$;

-- ─── 3. kotc_cast_vote — uczestnik = członek klubu w sesji ───────────────────
-- (identyczna logika/silnik jak wcześniej — zmiana tylko: team_members → club_members)
CREATE OR REPLACE FUNCTION public.kotc_cast_vote(p_game_id UUID, p_voted_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_game public.kotc_games; v_s public.kotc_sessions; v_votes INT;
  v_winner UUID; v_loser UUID; v_king UUID; v_streak INT; v_queue UUID[];
  v_chall UUID; v_pts INT; v_leader_score INT; v_winner_team UUID; v_na UUID; v_nb UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_game FROM public.kotc_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gierka nie znaleziona'; END IF;
  IF v_game.status <> 'voting' THEN RAISE EXCEPTION 'Głosowanie na tę gierkę jest zamknięte'; END IF;
  SELECT * INTO v_s FROM public.kotc_sessions WHERE id = v_game.session_id;
  IF NOT EXISTS (SELECT 1 FROM public.kotc_session_teams st JOIN public.club_members m ON m.club_id = st.team_id
    WHERE st.session_id = v_s.id AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Tylko uczestnicy sesji mogą głosować'; END IF;
  IF v_s.last_confirmed_at IS NOT NULL AND now() < v_s.last_confirmed_at + make_interval(secs => v_s.vote_cooldown_sec) THEN
    RAISE EXCEPTION 'Głosowanie odblokuje się po %s s od ostatniej zmiany', v_s.vote_cooldown_sec; END IF;
  IF p_voted_team_id NOT IN (v_game.team_a, v_game.team_b) THEN
    RAISE EXCEPTION 'Można głosować tylko na klub z tej gierki'; END IF;

  INSERT INTO public.kotc_game_votes(game_id, voter_id, voted_team_id)
  VALUES (p_game_id, auth.uid(), p_voted_team_id)
  ON CONFLICT (game_id, voter_id) DO UPDATE SET voted_team_id = EXCLUDED.voted_team_id, created_at = now();
  SELECT count(*) INTO v_votes FROM public.kotc_game_votes WHERE game_id = p_game_id AND voted_team_id = p_voted_team_id;
  IF v_votes < v_s.confirm_votes THEN
    RETURN jsonb_build_object('status','voting','votes',v_votes,'needed',v_s.confirm_votes); END IF;

  v_winner := p_voted_team_id;
  v_loser  := CASE WHEN v_game.team_a = v_winner THEN v_game.team_b ELSE v_game.team_a END;
  v_king := v_s.king_team_id; v_streak := v_s.streak; v_queue := v_s.queue;

  IF v_king IS NULL THEN
    v_queue := array_remove(array_remove(v_queue, v_winner), v_loser);
    UPDATE public.kotc_session_teams SET score = score + v_s.win_pts, wins = wins + 1, best_streak = GREATEST(best_streak, 1)
      WHERE session_id = v_s.id AND team_id = v_winner;
    v_king := v_winner; v_streak := 1; v_queue := v_queue || v_loser;
  ELSE
    v_chall := v_queue[1]; v_queue := v_queue[2:];
    IF v_winner = v_king THEN
      v_streak := v_streak + 1;
      v_pts := v_s.win_pts + CASE WHEN v_streak = v_s.rotate_after THEN v_s.streak3_bonus ELSE 0 END;
      UPDATE public.kotc_session_teams SET score = score + v_pts, wins = wins + 1, best_streak = GREATEST(best_streak, v_streak)
        WHERE session_id = v_s.id AND team_id = v_king;
      v_queue := v_queue || v_chall;
      IF v_streak >= v_s.rotate_after THEN v_queue := v_queue || v_king; v_king := NULL; v_streak := 0; END IF;
    ELSE
      UPDATE public.kotc_session_teams SET score = score + v_s.win_pts, wins = wins + 1, best_streak = GREATEST(best_streak, 1)
        WHERE session_id = v_s.id AND team_id = v_winner;
      v_queue := v_queue || v_king; v_king := v_winner; v_streak := 1;
    END IF;
  END IF;

  UPDATE public.kotc_games SET status = 'confirmed', winner_team_id = v_winner, confirmed_at = now() WHERE id = p_game_id;
  UPDATE public.kotc_sessions SET king_team_id = v_king, streak = v_streak, queue = v_queue, last_confirmed_at = now() WHERE id = v_s.id;

  SELECT max(score) INTO v_leader_score FROM public.kotc_session_teams WHERE session_id = v_s.id;
  IF v_leader_score >= v_s.target THEN
    SELECT team_id INTO v_winner_team FROM public.kotc_session_teams WHERE session_id = v_s.id ORDER BY score DESC, wins DESC LIMIT 1;
    UPDATE public.kotc_sessions SET status = 'finished', winner_team_id = v_winner_team, ended_at = now() WHERE id = v_s.id;
    RETURN jsonb_build_object('status','finished','winner_team',v_winner_team);
  END IF;

  IF v_king IS NULL THEN v_na := v_queue[1]; v_nb := v_queue[2];
  ELSE v_na := v_king; v_nb := v_queue[1]; END IF;
  INSERT INTO public.kotc_games(session_id, team_a, team_b, status) VALUES (v_s.id, v_na, v_nb, 'voting');
  RETURN jsonb_build_object('status','confirmed','winner',v_winner,'next_game',jsonb_build_array(v_na,v_nb));
END $$;

-- ─── 4. kotc_award_xp — po klubach (club_members) ───────────────────────────
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
  END LOOP;
  UPDATE public.kotc_sessions SET xp_awarded = true WHERE id = p_session_id;
END $$;
