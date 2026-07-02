-- ============================================================================
-- HoopConnect — King of the Court (pickup 3v3) — schema
-- Prawdziwe drużyny (public.teams) dołączają do sesji kodem. 4-6 drużyn.
-- Winner-stays, król schodzi po N obronach, punkty, cel sesji.
-- Wynik gierki potwierdzany wg trybu: host / kapitanowie / gracze (głosy).
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- ─── 1. SESJE ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kotc_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,                 -- krótki kod dołączenia
  host_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'lobby'
                  CHECK (status IN ('lobby','live','finished')),
  -- config (kalibrowalne bez deployu)
  target        INT  NOT NULL DEFAULT 90,
  rotate_after  INT  NOT NULL DEFAULT 3,
  win_pts       INT  NOT NULL DEFAULT 15,
  streak3_bonus INT  NOT NULL DEFAULT 5,
  min_teams     INT  NOT NULL DEFAULT 4,
  max_teams     INT  NOT NULL DEFAULT 6,
  confirm_mode  TEXT NOT NULL DEFAULT 'captains'      -- 'host' | 'captains' | 'players'
                  CHECK (confirm_mode IN ('host','captains','players')),
  -- stan rozgrywki
  king_team_id  UUID REFERENCES public.teams(id),
  streak        INT  NOT NULL DEFAULT 0,
  winner_team_id UUID REFERENCES public.teams(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kotc_sessions_code ON public.kotc_sessions(code);
CREATE INDEX IF NOT EXISTS idx_kotc_sessions_host ON public.kotc_sessions(host_id);

-- ─── 2. DRUŻYNY W SESJI ─────────────────────────────────────────────────────
-- Prawdziwe teamy dołączają do sesji. queue_pos porządkuje kolejkę.
CREATE TABLE IF NOT EXISTS public.kotc_session_teams (
  session_id  UUID NOT NULL REFERENCES public.kotc_sessions(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  queue_pos   INT,                       -- pozycja w kolejce (NULL = na boisku/aktywny)
  score       INT NOT NULL DEFAULT 0,
  wins        INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_kotc_session_teams_team ON public.kotc_session_teams(team_id);

-- ─── 3. GIERKI ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kotc_games (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.kotc_sessions(id) ON DELETE CASCADE,
  team_a         UUID NOT NULL REFERENCES public.teams(id),
  team_b         UUID NOT NULL REFERENCES public.teams(id),
  winner_team_id UUID REFERENCES public.teams(id),   -- NULL do potwierdzenia
  status         TEXT NOT NULL DEFAULT 'voting'
                   CHECK (status IN ('voting','confirmed')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kotc_games_session ON public.kotc_games(session_id, created_at);

-- ─── 4. GŁOSY NA WYNIK ──────────────────────────────────────────────────────
-- Gdy confirm_mode = 'players'/'captains': gracze głosują kto wygrał.
-- Próg = liczba graczy na boisku (players) albo 2 (captains).
CREATE TABLE IF NOT EXISTS public.kotc_game_votes (
  game_id       UUID NOT NULL REFERENCES public.kotc_games(id) ON DELETE CASCADE,
  voter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voted_team_id UUID NOT NULL REFERENCES public.teams(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (game_id, voter_id)
);

-- ─── 5. GŁOSY MVP (koniec sesji) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kotc_mvp_votes (
  session_id       UUID NOT NULL REFERENCES public.kotc_sessions(id) ON DELETE CASCADE,
  voter_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voted_player_id  UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, voter_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (podstawa — twardą logikę przejść robi RPC SECURITY DEFINER)
-- ============================================================================
ALTER TABLE public.kotc_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kotc_session_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kotc_games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kotc_game_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kotc_mvp_votes     ENABLE ROW LEVEL SECURITY;

-- Sesję widzi każdy zalogowany (dołączanie po kodzie); zmienia host.
DROP POLICY IF EXISTS "kotc read sessions" ON public.kotc_sessions;
CREATE POLICY "kotc read sessions" ON public.kotc_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kotc host inserts session" ON public.kotc_sessions;
CREATE POLICY "kotc host inserts session" ON public.kotc_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
DROP POLICY IF EXISTS "kotc host updates session" ON public.kotc_sessions;
CREATE POLICY "kotc host updates session" ON public.kotc_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid());

-- Drużyny/gierki/głosy: czytają zalogowani; zapisy przez RPC (definer) — INSERT/UPDATE ograniczone później.
DROP POLICY IF EXISTS "kotc read session_teams" ON public.kotc_session_teams;
CREATE POLICY "kotc read session_teams" ON public.kotc_session_teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kotc read games" ON public.kotc_games;
CREATE POLICY "kotc read games" ON public.kotc_games FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kotc read game_votes" ON public.kotc_game_votes;
CREATE POLICY "kotc read game_votes" ON public.kotc_game_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kotc vote game" ON public.kotc_game_votes;
CREATE POLICY "kotc vote game" ON public.kotc_game_votes FOR INSERT TO authenticated WITH CHECK (voter_id = auth.uid());
DROP POLICY IF EXISTS "kotc read mvp_votes" ON public.kotc_mvp_votes;
CREATE POLICY "kotc read mvp_votes" ON public.kotc_mvp_votes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kotc vote mvp" ON public.kotc_mvp_votes;
CREATE POLICY "kotc vote mvp" ON public.kotc_mvp_votes FOR INSERT TO authenticated WITH CHECK (voter_id = auth.uid());

-- Realtime (lobby + wyniki na żywo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.kotc_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kotc_session_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kotc_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kotc_game_votes;

-- ─── Generator kodu sesji (6 znaków, unikalny) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.kotc_gen_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c TEXT;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..6 LOOP c := c || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kotc_sessions WHERE code = c);
  END LOOP;
  RETURN c;
END; $$;

-- ============================================================================
-- TODO (następne RPC — SECURITY DEFINER, żeby logika była serwerowa i anty-cheat):
--   • kotc_create_session(config)          → tworzy sesję + kod
--   • kotc_join(code, team_id)             → dołącza drużynę (walidacja 4-6, kapitan)
--   • kotc_start(session_id)               → lobby → live, ustawia pierwszą parę
--   • kotc_cast_vote(game_id, team_id)     → głos; gdy próg → confirm + przejście silnika
--     (silnik = engine.js: winner stays, rotacja po 3, punkty, cel → finished + XP)
--   • kotc_vote_mvp(session_id, player_id) → głos MVP
-- ============================================================================
