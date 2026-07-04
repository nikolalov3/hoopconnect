-- ============================================================================
-- King of the Court — osiągnięcia (lipiec) + angielska wersja katalogu
--   • kotc_win_july  — za wygranie sesji (repeatable, zdobywasz wielokrotnie)
--   • kotc_play_july — za udział (repeatable/stackowalne: x2, x3, x5…)
-- Przyznawane serwerowo w kotc_award_xp (raz na sesję dzięki xp_awarded).
-- Run AFTER 20260622_kotc_clubs.sql.
-- ============================================================================

-- angielskie kolumny w katalogu (jeśli brak)
ALTER TABLE public.achievements_catalog ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.achievements_catalog ADD COLUMN IF NOT EXISTS description_en TEXT;

-- katalog osiągnięć KotC
INSERT INTO public.achievements_catalog (id, title, title_en, description, description_en, type, stages, threshold, is_active)
VALUES
('kotc_win_july', 'King of the Court · Lipiec', 'King of the Court · July',
 'Wygrałeś sesję King of the Court. Zdobywaj wielokrotnie!',
 'You won a King of the Court session. Earn it again and again!',
 'repeatable',
 '[{"medal":"gold","threshold":1,"image":"/kotc0726.png","description":"Wygrana sesja King of the Court","description_en":"Won a King of the Court session"}]'::jsonb,
 1, true),
('kotc_play_july', 'Gracz King of the Court · Lipiec', 'King of the Court Player · July',
 'Zagrałeś w sesji King of the Court. Stackuj kolejne występy (x2, x3, x5…)!',
 'You played a King of the Court session. Stack your appearances (x2, x3, x5…)!',
 'repeatable',
 '[{"medal":"silver","threshold":1,"image":"/kotklogo.png","description":"Udział w sesji King of the Court","description_en":"Played a King of the Court session"}]'::jsonb,
 1, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, title_en = EXCLUDED.title_en,
  description = EXCLUDED.description, description_en = EXCLUDED.description_en,
  type = EXCLUDED.type, stages = EXCLUDED.stages,
  threshold = EXCLUDED.threshold, is_active = true;

-- kotc_award_xp — jak w 20260622_kotc_clubs.sql + przyznanie osiągnięć
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

    -- osiągnięcia (raz na sesję dzięki xp_awarded; achievement_id unikalny per sesja)
    INSERT INTO public.user_achievements(user_id, achievement_id, base_id)
    VALUES (r.uid, 'kotc_play_july:' || p_session_id, 'kotc_play_july');
    IF r.team_id = v_s.winner_team_id THEN
      INSERT INTO public.user_achievements(user_id, achievement_id, base_id)
      VALUES (r.uid, 'kotc_win_july:' || p_session_id, 'kotc_win_july');
    END IF;
  END LOOP;
  UPDATE public.kotc_sessions SET xp_awarded = true WHERE id = p_session_id;
END $$;
