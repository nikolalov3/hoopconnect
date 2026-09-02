-- ============================================================================
-- Arena ladder — SYNC serwera z frontem + PODNIESIENIE progów
--
-- BUG, który to naprawia: serwerowy arena_level_for_xp był nieaktualny —
--   6 poziomów (0–5), progi 500/1500/3500/7500/15000 — podczas gdy front
--   (src/lib/arenas.js + ClubPage.jsx ARENAS + HomePage.jsx ARENA_META) ma
--   7 poziomów (0–6): Rozgrzewka/Street Court/City Run/Golden Reign/Ankh Court/
--   Void Gem/Seraphim. Skutek: Seraphim był NIEOSIĄGALNY (serwer nigdy nie
--   zwracał 6), a środek drabiny źle się mapował.
--
-- Ta migracja ustawia serwer na 7 poziomów i PODNOSI progi (Seraphim 7500→40000),
-- żeby maks nie był do wbicia w ~2 tygodnie. Wczesne areny zostają szybkie.
--
--   0 Rozgrzewka   —      0
--   1 Street Court —    500
--   2 City Run     —  1 500
--   3 Golden Reign —  4 000   (było 2 700)
--   4 Ankh Court   —  9 000   (było 3 900)
--   5 Void Gem     — 20 000   (było 5 500)
--   6 Seraphim     — 40 000   (było 7 500)
--
-- ⚠️  FRONT MUSI DOSTAĆ TE SAME LICZBY (osobny krok, ten sam deploy):
--     • src/lib/arenas.js        → ARENAS[].threshold
--     • src/pages/ClubPage.jsx    → const ARENAS[].threshold
--     • src/pages/HomePage.jsx    → ARENA_META (jeśli trzyma progi)
--
-- Run once w Supabase → SQL Editor. Idempotentne.
-- ============================================================================

-- UWAGA: parametr MUSI nazywać się `xp_val` — tak nazywa się na żywej bazie,
-- a CREATE OR REPLACE nie pozwala zmienić nazwy parametru (stąd błąd 42P13,
-- gdyby użyć innej nazwy). Zostawiamy `xp_val`, żeby replace przeszło bez DROP.
create or replace function public.arena_level_for_xp(xp_val integer)
returns integer
language sql
immutable
as $$
  select case
    when xp_val >= 40000 then 6   -- Seraphim
    when xp_val >= 20000 then 5   -- Void Gem
    when xp_val >=  9000 then 4   -- Ankh Court
    when xp_val >=  4000 then 3   -- Golden Reign
    when xp_val >=  1500 then 2   -- City Run
    when xp_val >=   500 then 1   -- Street Court
    else 0                        -- Rozgrzewka
  end
$$;

-- Przelicz arena_level WSZYSTKIM wg nowej drabiny (uczciwie: wcześnie, mało userów).
-- Kto był "wyżej" na starych, zbyt niskich progach — spadnie do realnego poziomu.
update public.profiles
   set arena_level = public.arena_level_for_xp(coalesce(xp, 0))
 where arena_level is distinct from public.arena_level_for_xp(coalesce(xp, 0));
