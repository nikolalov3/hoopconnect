-- ============================================================================
-- King of the Court — XP po sesji (+ limit dzienny)
-- Trigger: gdy sesja → 'finished', rozdaj XP uczestnikom przez add_player_xp.
--   udział +75 · zwycięstwo sesji +200 · drużyna 50+ pkt +100 (każdy z drużyny)
--   (MVP +150 dojdzie w RPC głosowania MVP)
-- Limit dzienny: 500 XP z tego trybu / gracz / dzień (anty-farm).
-- Run AFTER 20260621_kotc*.sql.
-- ============================================================================

-- idempotencja (żeby nie rozdać XP dwa razy tej samej sesji)
ALTER TABLE public.kotc_sessions ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN NOT NULL DEFAULT false;

-- ledger XP z trybu (limit dzienny + historia)
CREATE TABLE IF NOT EXISTS public.kotc_xp_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.kotc_sessions(id) ON DELETE SET NULL,
  amount     INT  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kotc_xp_log_user_day ON public.kotc_xp_log(user_id, created_at);
ALTER TABLE public.kotc_xp_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kotc read own xp" ON public.kotc_xp_log;
CREATE POLICY "kotc read own xp" ON public.kotc_xp_log FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── rozdanie XP ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kotc_award_xp(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_s     public.kotc_sessions;
  v_cap   INT := 500;          -- limit dzienny XP z tego trybu / gracz
  r       RECORD;
  v_amt   INT;
  v_today INT;
BEGIN
  SELECT * INTO v_s FROM public.kotc_sessions WHERE id = p_session_id;
  IF v_s.id IS NULL OR v_s.status <> 'finished' OR v_s.xp_awarded THEN RETURN; END IF;

  FOR r IN
    SELECT DISTINCT m.player_id AS uid, st.team_id, st.score
    FROM public.kotc_session_teams st
    JOIN public.team_members m ON m.team_id = st.team_id
    WHERE st.session_id = p_session_id
  LOOP
    v_amt := 75;                                                   -- udział
    IF r.team_id = v_s.winner_team_id THEN v_amt := v_amt + 200; END IF;  -- zwycięstwo sesji
    IF r.score >= 50 THEN v_amt := v_amt + 100; END IF;                    -- drużyna 50+ pkt

    -- limit dzienny
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

-- ─── trigger: sesja → finished → rozdaj XP ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_kotc_award_on_finish()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF new.status = 'finished' AND (old.status IS DISTINCT FROM 'finished') THEN
    PERFORM public.kotc_award_xp(new.id);
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS kotc_award_on_finish ON public.kotc_sessions;
CREATE TRIGGER kotc_award_on_finish
  AFTER UPDATE ON public.kotc_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_kotc_award_on_finish();
