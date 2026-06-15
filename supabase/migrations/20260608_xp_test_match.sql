-- ============================================================
--  TEST ONLY — powiększa nagrodę za mecz do 500 XP (próg Areny 1),
--  żeby jeden testowy, ukończony mecz od razu pokazał awans areny
--  i animacje XP w aplikacji.
--
--  Po teście wróć do wartości produkcyjnych (25 XP):
--    • wgraj ponownie 20260607_xp_arena_system.sql w SQL Editor
--    • lub ręcznie zmień 500 → 25 poniżej i uruchom jeszcze raz
-- ============================================================

create or replace function public.trg_award_match_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if NEW.status = 'completed'
     and (OLD.status is distinct from 'completed')
     and NEW.walkover is null
     and NEW.away_club_id is not null
  then
    for r in
      select user_id from public.match_players where match_id = NEW.id
    loop
      -- TEST: 500 XP = dokładnie próg Areny 1 (Training Hall)
      -- PRODUKCJA: zmień z powrotem na 25
      perform public.add_player_xp(r.user_id, 500);
    end loop;
  end if;

  return NEW;
end;
$$;
