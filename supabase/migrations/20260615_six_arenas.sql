-- ============================================================
--  7-poziomowy system aren (0-6):
--    0 Rozgrzewka    (0 XP, brak ramki)
--    1 Street Court  (500 XP)
--    2 City Run      (1500 XP)
--    3 Golden Reign  (2700 XP)
--    4 Ankh Court    (3900 XP)
--    5 Void Gem      (5500 XP)
--    6 Seraphim      (7500 XP)
--
--  Mirror: src/lib/arenas.js (ARENAS), src/pages/HomePage.jsx (ARENA_META),
--  src/pages/ClubPage.jsx (local ARENAS).
--
--  Uruchom po każdej zmianie progów/listy aren.
-- ============================================================

-- Stara wersja miała inną nazwę parametru (p_xp) — Postgres nie pozwala
-- zmienić nazwy parametru przez CREATE OR REPLACE, więc usuwamy ją najpierw.
drop function if exists public.arena_level_for_xp(integer);

create function public.arena_level_for_xp(xp_val integer)
returns integer
language sql
immutable
as $$
  select case
    when xp_val >= 7500 then 6   -- Seraphim
    when xp_val >= 5500 then 5   -- Void Gem
    when xp_val >= 3900 then 4   -- Ankh Court
    when xp_val >= 2700 then 3   -- Golden Reign
    when xp_val >= 1500 then 2   -- City Run
    when xp_val >= 500  then 1   -- Street Court
    else                     0   -- Rozgrzewka
  end
$$;

-- Synchronizuj arena_level dla wszystkich istniejących graczy z nowymi progami
update public.profiles
set arena_level = public.arena_level_for_xp(coalesce(xp, 0))
where true;
