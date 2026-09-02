-- ============================================================================
-- XP rebalance — "granie realne z ludźmi > trening solo" (twardo)
--
-- 1) Mecze (club_matches, oba wyniki, realny rywal): win 35→75, loss 15→40 XP.
--    (Draft Score 50/20 pkt zostaje bez zmian.)
-- 2) Trening (Tier 2): tygodniowa pula ×0.1 → XP DOSTAJE SUFIT 100 XP/tydz.
--    Dotąd było bez sufitu — jedyna dziura, przez którą solo-grind mógł gonić
--    realną grę. Cap zamyka: tydzień treningu ≤ ~1,3 wygranego meczu.
--
-- KotC XP (podział wg miejsca + cap dzienny 750 + Draft Score) siedzi w
-- osobnej migracji 20260902_kotc_solo.sql (bo to część przebudowy KotC).
--
-- Run once w Supabase → SQL Editor. Idempotentne (create or replace).
-- ============================================================================

-- ─── 1) Mecz: win 75 / loss 40 XP (+ 50/20 Draft Score) ─────────────────────
create or replace function public.trg_award_match_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_today  date := current_date;
  v_week   integer := public.calendar_week_number(current_date);
  v_xp     integer;
  v_pts    integer;
  v_won    boolean;
begin
  if NEW.status = 'completed'
     and (OLD.status is distinct from 'completed')
     and NEW.walkover is null
     and NEW.away_club_id is not null
  then
    for r in
      select user_id, team from public.match_players where match_id = NEW.id
    loop
      v_won := (r.team = 'home' and NEW.score_home > NEW.score_away)
            or (r.team = 'away' and NEW.score_away > NEW.score_home);

      if v_won then
        v_xp := 75; v_pts := 50;          -- było 35 / 50
      else
        v_xp := 40; v_pts := 20;          -- było 15 / 20 (remis liczony jak przegrana)
      end if;

      perform public.add_player_xp(r.user_id, v_xp);

      insert into public.points_log (user_id, training_id, points, week_number, date, source, match_id)
      values (r.user_id, null, v_pts, v_week, v_today, 'match', NEW.id)
      on conflict (user_id, match_id, source) do nothing;
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists award_match_xp on public.club_matches;
create trigger award_match_xp
  after update on public.club_matches
  for each row
  execute function public.trg_award_match_xp();

-- ─── 2) Trening tygodniowy: XP z puli ×0.1, ale CAP 100 XP/tydz. ─────────────
create or replace function public.trg_award_weekly_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_player_xp(
    NEW.user_id,
    least( round(coalesce(NEW.total_points, 0) * 0.1)::integer, 100 )   -- ← cap 100
  );

  update public.profiles
     set draft_score_reset_at = now()
   where id = NEW.user_id;

  return NEW;
end;
$$;

drop trigger if exists award_weekly_xp on public.weekly_reports;
create trigger award_weekly_xp
  after insert on public.weekly_reports
  for each row
  execute function public.trg_award_weekly_xp();
