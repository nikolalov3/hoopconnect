-- ============================================================================
-- Per-player stats for the coach's player page. One SECURITY DEFINER RPC, scoped
-- by is_team_coach + team membership, returning a JSON blob:
--   arena_level, xp, attendance {present,late,absent,total},
--   last_week_score (same computation as the roster / leaderboard),
--   shooting { <shot_type>: {made, attempted}, ... }
--
-- A coach reads these only for players on their own team (base tables stay
-- owner-only / gated under RLS). Designed to grow — add fields to the JSON as the
-- player page gains sections (future: tournament points/assists).
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

create or replace function public.get_player_stats(p_team_id uuid, p_player_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_arena int; v_xp int;
  v_present int; v_late int; v_absent int; v_total int;
  v_start date; v_end date; v_week int;
  v_shooting jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_coach(p_team_id) then
    raise exception 'not authorized for this team';
  end if;
  if not exists (select 1 from public.team_members
                  where team_id = p_team_id and player_id = p_player_id) then
    raise exception 'player not in team';
  end if;

  -- arena + xp (permanent progression)
  select coalesce(arena_level, 0), coalesce(xp, 0)
    into v_arena, v_xp
    from public.profiles where id = p_player_id;

  -- attendance across this team's practices
  select
    count(*) filter (where pa.status = 'present'),
    count(*) filter (where pa.status = 'late'),
    count(*) filter (where pa.status = 'absent'),
    count(*)
  into v_present, v_late, v_absent, v_total
  from public.practice_attendance pa
  join public.team_practice tp on tp.id = pa.practice_id
  where tp.team_id = p_team_id and pa.player_id = p_player_id;

  -- last completed league week score (match 1.0 / training 0.5 / achievement 0.75)
  select lp.starts_at, lp.ends_at into v_start, v_end
    from public.league_periods lp
   where lp.ends_at < (now() at time zone 'utc')::date
   order by lp.ends_at desc limit 1;

  select coalesce(sum(round(pl.points * case pl.source
           when 'training' then 0.5 when 'achievement' then 0.75 else 1.0 end)), 0)::int
    into v_week
    from public.points_log pl
   where pl.user_id = p_player_id and v_start is not null
     and pl.date >= v_start and pl.date <= v_end;

  -- shooting totals per shot type
  select coalesce(
           jsonb_object_agg(shot_type, jsonb_build_object('made', made_sum, 'attempted', att_sum)),
           '{}'::jsonb)
    into v_shooting
  from (
    select shot_type, sum(made) as made_sum, sum(attempted) as att_sum
    from public.shooting_sessions
    where user_id = p_player_id
    group by shot_type
  ) s;

  return jsonb_build_object(
    'arena_level',     v_arena,
    'xp',              v_xp,
    'attendance',      jsonb_build_object('present', v_present, 'late', v_late, 'absent', v_absent, 'total', v_total),
    'last_week_score', v_week,
    'shooting',        v_shooting
  );
end;
$$;

revoke all on function public.get_player_stats(uuid, uuid) from public;
grant execute on function public.get_player_stats(uuid, uuid) to authenticated;
