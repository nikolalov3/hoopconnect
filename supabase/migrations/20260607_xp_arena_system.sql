-- ============================================================
--  XP & Arena progression system
--  Implements the spec from "System XP i Areny":
--
--    Formuła XP
--    • Mecz zakończony (obaj kapitanowie wpisali wynik) → +25 XP
--    • Koniec tygodnia: 1/10 końcowego Draft Score → XP permanentny
--    • (Season Pass 2x mnożniki — patrz komentarze na dole, NIE
--      zaimplementowane bo funkcja Season Pass jeszcze nie istnieje)
--
--    Progi aren (mirror of frontend `ARENAS` in ClubPage.jsx):
--      0 Street Court   —     0 XP
--      1 Training Hall  —   500 XP
--      2 Academy        —  1500 XP
--      3 Semi-Pro       —  3500 XP
--      4 Pro Arena      —  7500 XP
--      5 Elite          — 15000 XP
--
--  Everything below runs server-side (triggers + security-definer
--  helpers) so XP is granted automatically and atomically whenever
--  a match completes or a weekly Draft Score gets archived — no
--  client-side code changes needed, and no client can self-grant XP
--  (RLS on `profiles` only allows users to update their OWN row,
--  and `add_player_xp` is intentionally NOT exposed to `authenticated`).
-- ============================================================

-- 1) Columns on profiles (idempotent — safe if already added manually) ───────
alter table public.profiles
  add column if not exists xp          integer not null default 0,
  add column if not exists arena_level integer not null default 0;

-- 2) Pure lookup: XP → arena level, mirrors the `ARENAS` thresholds in the UI.
--    Keep this in sync with `const ARENAS` in src/pages/ClubPage.jsx if the
--    progression curve ever changes.
create or replace function public.arena_level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select case
    when p_xp >= 15000 then 5
    when p_xp >= 7500  then 4
    when p_xp >= 3500  then 3
    when p_xp >= 1500  then 2
    when p_xp >= 500   then 1
    else 0
  end
$$;

-- 3) Internal helper — atomically add (or remove, if negative) XP and recompute
--    arena_level in one go. SECURITY DEFINER so triggers can grant XP to ANY
--    player (e.g. match opponents), bypassing the "update own profile only"
--    RLS policy — but it is intentionally NOT granted to `authenticated`,
--    so it can only be invoked from trusted server-side trigger contexts,
--    never directly by a client (no self-XP-granting possible).
create or replace function public.add_player_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_xp integer;
begin
  if p_amount = 0 or p_user_id is null then
    return;
  end if;

  update public.profiles
     set xp = greatest(0, xp + p_amount)
   where id = p_user_id
   returning xp into v_new_xp;

  if v_new_xp is not null then
    update public.profiles
       set arena_level = public.arena_level_for_xp(v_new_xp)
     where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.add_player_xp(uuid, integer) from public, authenticated, anon;

-- 4) Trigger — +25 XP per participant when a match is genuinely completed
--    by BOTH captains (not auto-confirmed solo scrimmages, not walkovers).
--    "Both captains entered the result" ⇒ the match had a real away club
--    (away_club_id is set) and finished through the normal confirm/dispute
--    flow (walkover is null). Fires once per match, exactly on the
--    open/result_pending/disputed → completed transition.
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
      perform public.add_player_xp(r.user_id, 25);
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

-- 5) Trigger — convert 1/10 of the just-archived weekly Draft Score into
--    permanent XP. Piggybacks on the existing lazy-archival flow in
--    HomePage.jsx (`weekly_reports` gets one row inserted per user per
--    completed week, with `total_points` = that week's final Draft Score).
create or replace function public.trg_award_weekly_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_player_xp(
    NEW.user_id,
    floor(coalesce(NEW.total_points, 0) / 10.0)::integer
  );
  return NEW;
end;
$$;

drop trigger if exists award_weekly_xp on public.weekly_reports;
create trigger award_weekly_xp
  after insert on public.weekly_reports
  for each row
  execute function public.trg_award_weekly_xp();

-- ============================================================
--  Season Pass multipliers — NOT implemented (feature doesn't exist yet).
--
--  When Season Pass ships, the cleanest hook points are:
--   • trg_award_weekly_xp  → before calling add_player_xp, check the
--     player's active Season Pass and use `floor(total_points / 5.0)`
--     instead of `/ 10.0` (i.e. 2/10 instead of 1/10).
--   • trg_award_match_xp   → check a time-boxed "power-up" flag/expiry
--     on the profile (e.g. `season_pass_powerup_until timestamptz`) and
--     grant 50 XP instead of 25 while it's active.
--  Both just need a small `season_pass_*` column set on `profiles` (or a
--  dedicated table) plus one extra `if` per trigger — no structural changes
--  to the XP/arena machinery above.
-- ============================================================
