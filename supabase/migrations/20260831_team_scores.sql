-- ============================================================================
-- Coach roster stats: for each player on a coach's team, return their arena level
-- + XP (permanent progression, always current) and their LAST COMPLETED week's
-- score, computed exactly like the player leaderboard (points_log summed with the
-- per-source multipliers: match 1.0, training 0.5, achievement 0.75, rounded per
-- row) over the previous league_period. "Last week" = a settled number, better
-- for a coach report than a live-changing current week.
--
-- SECURITY DEFINER + is_team_coach: a coach reads these only for players on their
-- own team (base profiles/points_log stay owner-only under RLS).
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

create or replace function public.get_team_scores(p_team_id uuid)
returns table (
  player_id       uuid,
  arena_level     int,
  xp              int,
  last_week_score int
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end   date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_coach(p_team_id) then
    raise exception 'not authorized for this team';
  end if;

  -- Last COMPLETED league week = most recent period that already ended (UTC).
  select lp.starts_at, lp.ends_at into v_start, v_end
    from public.league_periods lp
   where lp.ends_at < (now() at time zone 'utc')::date
   order by lp.ends_at desc
   limit 1;

  return query
    select
      tm.player_id,
      coalesce(p.arena_level, 0)::int,
      coalesce(p.xp, 0)::int,
      coalesce(sum(
        round(pl.points * case pl.source
          when 'training'    then 0.5
          when 'achievement' then 0.75
          else 1.0
        end)
      ), 0)::int as last_week_score
    from public.team_members tm
    join public.profiles p on p.id = tm.player_id
    left join public.points_log pl
      on pl.user_id = tm.player_id
     and v_start is not null
     and pl.date >= v_start and pl.date <= v_end
   where tm.team_id = p_team_id
   group by tm.player_id, p.arena_level, p.xp;
end;
$$;

revoke all on function public.get_team_scores(uuid) from public;
grant execute on function public.get_team_scores(uuid) to authenticated;
