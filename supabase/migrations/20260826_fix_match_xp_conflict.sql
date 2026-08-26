-- ============================================================================
-- Fix trg_award_match_xp: its `INSERT ... ON CONFLICT (user_id, match_id, source)`
-- has NO WHERE clause, but the intended arbiter index uniq_points_log_match_source
-- is PARTIAL (WHERE match_id IS NOT NULL). A no-WHERE ON CONFLICT can't use a
-- partial index → ERROR 42P10 the moment the trigger actually inserts. It was
-- dormant only because away_club_id was always NULL (the IF guard was false and the
-- insert was never reached). Now that away_club_id persists correctly, EVERY club
-- match completion would hit this — so this must be fixed alongside that change.
--
-- Fix: ensure the partial unique index exists, and give the trigger's ON CONFLICT
-- the SAME predicate so it matches. Idempotent (create or replace / if not exists).
-- ============================================================================

create unique index if not exists uniq_points_log_match_source
  on public.points_log (user_id, match_id, source)
  where match_id is not null;

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
        v_xp := 35; v_pts := 50;
      else
        v_xp := 15; v_pts := 20;   -- przegrana i remis liczone jak przegrana
      end if;

      perform public.add_player_xp(r.user_id, v_xp);

      insert into public.points_log (user_id, training_id, points, week_number, date, source, match_id)
      values (r.user_id, null, v_pts, v_week, v_today, 'match', NEW.id)
      on conflict (user_id, match_id, source) where match_id is not null do nothing;
    end loop;
  end if;

  return NEW;
end;
$$;
