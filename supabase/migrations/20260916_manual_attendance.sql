-- ============================================================================
-- Frekwencja dla zawodników ręcznych (ghost, bez konta).
-- Osobna tabela `manual_attendance` — NIE ruszamy `practice_attendance` (PK na
-- profiles, używane przez apkę gracza i streak frekwencji). Ghost = team_manual_players.
--   • mark_manual_attendance(practice, manual, status)  — zaznaczanie ghosta
--   • get_practice_attendance(practice)  — rozszerzone o ghostów (kolumna is_manual)
-- RLS: tylko trener-właściciel drużyny treningu. Idempotentna.
-- ============================================================================

create table if not exists public.manual_attendance (
  practice_id uuid not null references public.team_practice(id) on delete cascade,
  manual_id   uuid not null references public.team_manual_players(id) on delete cascade,
  status      text not null check (status in ('present','late','absent')),
  marked_by   uuid,
  marked_at   timestamptz default now(),
  primary key (practice_id, manual_id)
);
create index if not exists idx_manual_attendance_manual on public.manual_attendance(manual_id);

alter table public.manual_attendance enable row level security;
drop policy if exists manual_attendance_coach on public.manual_attendance;
create policy manual_attendance_coach on public.manual_attendance for all
  using (practice_id in (
    select tp.id from public.team_practice tp
     where tp.team_id in (select id from public.teams where coach_id = auth.uid())))
  with check (practice_id in (
    select tp.id from public.team_practice tp
     where tp.team_id in (select id from public.teams where coach_id = auth.uid())));

-- ─── mark_manual_attendance ─────────────────────────────────────────────────
create or replace function public.mark_manual_attendance(
  p_practice_id uuid, p_manual_id uuid, p_status text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team_id uuid;
begin
  select team_id into v_team_id from public.team_practice where id = p_practice_id;
  if not found then raise exception 'practice not found'; end if;
  if not public.is_team_coach(v_team_id) then raise exception 'not authorized'; end if;

  if p_status is null then
    delete from public.manual_attendance where practice_id = p_practice_id and manual_id = p_manual_id;
  else
    if p_status not in ('present','late','absent') then raise exception 'invalid status: %', p_status; end if;
    insert into public.manual_attendance (practice_id, manual_id, status, marked_by)
    values (p_practice_id, p_manual_id, p_status, auth.uid())
    on conflict (practice_id, manual_id) do update
      set status = excluded.status, marked_by = auth.uid(), marked_at = now();
  end if;
end; $$;
revoke all on function public.mark_manual_attendance(uuid, uuid, text) from public;
grant execute on function public.mark_manual_attendance(uuid, uuid, text) to authenticated;

-- ─── get_practice_attendance — rozszerzone o ghostów (+ is_manual) ───────────
-- Zmiana sygnatury (nowa kolumna) → trzeba DROP + CREATE.
drop function if exists public.get_practice_attendance(uuid);
create function public.get_practice_attendance(p_practice_id uuid)
returns table (
  player_id           uuid,
  display_first_name  text,
  display_last_name   text,
  jersey_number       int,
  player_email        text,
  status              text,
  is_manual           boolean
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_team_id uuid;
begin
  select team_id into v_team_id from public.team_practice where id = p_practice_id;
  if not found then raise exception 'practice not found'; end if;
  if not public.is_team_coach(v_team_id) then raise exception 'not authorized'; end if;

  return query
    select tm.player_id, tm.display_first_name, tm.display_last_name,
           tm.jersey_number, u.email::text, pa.status::text, false
      from public.team_members tm
      join auth.users u on u.id = tm.player_id
      left join public.practice_attendance pa
        on pa.practice_id = p_practice_id and pa.player_id = tm.player_id
     where tm.team_id = v_team_id
  union all
    select mp.id, mp.first_name, mp.last_name,
           mp.jersey_number, null::text, ma.status::text, true
      from public.team_manual_players mp
      left join public.manual_attendance ma
        on ma.practice_id = p_practice_id and ma.manual_id = mp.id
     where mp.team_id = v_team_id
  order by 7 asc, 3 asc;   -- is_manual, display_last_name
end; $$;
revoke all on function public.get_practice_attendance(uuid) from public;
grant execute on function public.get_practice_attendance(uuid) to authenticated;
