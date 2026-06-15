-- ============================================================
--  Trzy liczniki — XP / Draft Score / Pula treningowa
--
--    1) XP            — permanentny, nigdy nie spada, napędza arena_level.
--    2) Draft Score   — tygodniowy (leaderboard), reset co poniedziałek
--                        00:00 ORAZ natychmiast przy awansie areny.
--    3) Pula trening. — punkty z treningu/rzutów w trakcie tygodnia,
--                        w poniedziałek batchowane do XP (round(0.1×pula)),
--                        potem zerowana razem z Draft Score.
--
--  Mecze (zweryfikowane, oba team_id + wynik):
--    Wygrana:   +35 XP natychmiast (permanent) + 50 do Draft Score
--    Przegrana: +15 XP natychmiast (permanent) + 20 do Draft Score
--
--  Implementacja:
--   • `profiles.draft_score_reset_at` — punkt odcięcia dla Draft Score.
--     Front liczy Draft Score jako sumę `points_log.points` WHERE
--     date >= max(poniedziałek tego tygodnia, draft_score_reset_at).
--   • `add_player_xp` — gdy awans areny, ustawia draft_score_reset_at = now()
--     (Draft Score spada do 0 od razu, bez usuwania historii w points_log).
--   • `trg_award_match_xp` — rozróżnia win/loss per gracz na podstawie
--     match_players.team vs score_home/score_away, daje 35/15 XP
--     + insert do points_log (source='match', 50/20 pkt).
--   • `trg_award_weekly_xp` — w poniedziałek (lazy archival z frontu wstawia
--     wiersz do weekly_reports z total_points = SUMA TYLKO source='training'
--     za zakończony tydzień, czyli "pula treningowa"): xp += round(0.1×pula),
--     i resetuje draft_score_reset_at = now() (zerując jednocześnie Draft
--     Score i pulę treningową na kolejny tydzień).
-- ============================================================

-- 1) profiles.draft_score_reset_at ────────────────────────────────────────
alter table public.profiles
  add column if not exists draft_score_reset_at timestamptz not null default now();

-- 2) Pomocnicza: globalny numer tygodnia (Mon 00:00 UTC), mirror lib/week.js ─
create or replace function public.calendar_week_number(p_date date default current_date)
returns integer
language sql
immutable
as $$
  select floor(
    (p_date - (extract(isodow from p_date)::int - 1) - date '2024-01-01')::numeric / 7
  )::integer + 1
$$;

-- 3) add_player_xp — przy awansie areny resetuje Draft Score natychmiast ──
create or replace function public.add_player_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_level integer;
  v_new_xp    integer;
  v_new_level integer;
begin
  if p_amount = 0 or p_user_id is null then
    return;
  end if;

  select arena_level into v_old_level from public.profiles where id = p_user_id;

  update public.profiles
     set xp = greatest(0, xp + p_amount)
   where id = p_user_id
   returning xp into v_new_xp;

  if v_new_xp is not null then
    v_new_level := public.arena_level_for_xp(v_new_xp);

    update public.profiles
       set arena_level = v_new_level,
           draft_score_reset_at = case
             when v_new_level > coalesce(v_old_level, 0) then now()
             else draft_score_reset_at
           end
     where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.add_player_xp(uuid, integer) from public, authenticated, anon;

-- 4) Mecz — win/loss → 35/15 XP + 50/20 Draft Score ────────────────────────
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
        -- przegrana ORAZ remis (spec nie definiuje remisu — traktujemy jak przegraną)
        v_xp := 15; v_pts := 20;
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

-- 5) Idempotencja punktów meczowych — jeden wpis source='match' per gracz/mecz
create unique index if not exists uniq_points_log_match_source
  on public.points_log (user_id, match_id, source)
  where match_id is not null;

-- 6) Batch poniedziałkowy — total_points (archiwizowany przez front jako suma
--    TYLKO source='training' za zakończony tydzień) → round(0.1×pula) XP,
--    + reset draft_score_reset_at (zeruje Draft Score i pulę na nowy tydzień)
create or replace function public.trg_award_weekly_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_player_xp(
    NEW.user_id,
    round(coalesce(NEW.total_points, 0) * 0.1)::integer
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
