-- ============================================================
--  3-arenowy system: Playground / Street Court / Sól tej Ziemi
--  "Sół tej Ziemi" jest zawsze szczytem — gdy dodasz nową arenę,
--  wstaw ją do CASE przed ostatnim progiem i podnieś próg Sól.
--
--  Uruchom po każdej zmianie listy aren.
-- ============================================================

-- Funkcja wyznaczająca level na podstawie XP
create or replace function public.arena_level_for_xp(xp_val integer)
returns integer
language sql
immutable
as $$
  select case
    when xp_val >= 1500 then 2   -- Sół tej Ziemi
    when xp_val >= 500  then 1   -- Street Court
    else                     0   -- Playground
  end
$$;

-- Synchronizuj arena_level dla wszystkich istniejących graczy
-- (na wypadek gdyby mieli np. level 3-5 z poprzedniego systemu)
update public.profiles
set arena_level = public.arena_level_for_xp(coalesce(xp, 0))
where true;
