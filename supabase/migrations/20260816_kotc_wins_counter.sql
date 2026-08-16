-- ── KotC: niezależny licznik wygranych + miesięczny badge (Sierpień) ───────────
-- 1) profiles.kotc_wins — WŁASNY licznik wygranych KotC (na karcie gracza),
--    całkowicie niezależny od osiągnięć. Inkrementowany server-side przez RPC.
-- 2) Backfill z dotychczasowych osiągnięć kotc_win_* (żeby dotychczasowi zwycięzcy
--    nie stracili swojego licznika).
-- 3) Miesięczny badge: kotc_win_august (lipcowy kotc_win_july zostaje = historia).
-- 4) kotc_award_xp: przy wygranej robi +1 do profiles.kotc_wins ORAZ przyznaje
--    sierpniowy badge (osobne rzeczy — licznik nie zależy od osiągnień).
--
-- Uruchom raz w Supabase → SQL Editor.

-- 1) licznik na profilu
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kotc_wins INT NOT NULL DEFAULT 0;

-- 2) backfill z istniejących osiągnięć kotc_win_*
UPDATE public.profiles p
SET kotc_wins = sub.c
FROM (
  SELECT user_id, count(*)::int AS c
  FROM public.user_achievements
  WHERE base_id LIKE 'kotc_win_%'
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;

-- 3) katalog: sierpniowy badge zwycięzcy
INSERT INTO public.achievements_catalog (id, title, title_en, description, description_en, type, stages, threshold, is_active)
VALUES
('kotc_win_august', 'King of the Court · Sierpień', 'King of the Court · August',
 'Wygrałeś sesję King of the Court. Zdobywaj wielokrotnie!',
 'You won a King of the Court session. Earn it again and again!',
 'repeatable',
 '[{"medal":"gold","threshold":1,"image":"/kotc0726.png","description":"Wygrana sesja King of the Court","description_en":"Won a King of the Court session"}]'::jsonb,
 1, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, title_en = EXCLUDED.title_en,
  description = EXCLUDED.description, description_en = EXCLUDED.description_en,
  type = EXCLUDED.type, stages = EXCLUDED.stages, threshold = EXCLUDED.threshold, is_active = EXCLUDED.is_active;

-- 4) RPC: +1 do licznika (niezależnie) oraz sierpniowy badge zwycięzcy
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

    -- TYLKO zwycięzca
    IF r.team_id = v_s.winner_team_id THEN
      -- niezależny licznik wygranych (widoczny na karcie)
      UPDATE public.profiles SET kotc_wins = coalesce(kotc_wins, 0) + 1 WHERE id = r.uid;
      -- miesięczny badge (osiągnięcia; osobno od licznika)
      INSERT INTO public.user_achievements(user_id, achievement_id, base_id)
      VALUES (r.uid, 'kotc_win_august:' || p_session_id, 'kotc_win_august');
    END IF;
  END LOOP;
  UPDATE public.kotc_sessions SET xp_awarded = true WHERE id = p_session_id;
END $$;
