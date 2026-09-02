-- ============================================================================
-- KotC solo — SPRZĄTANIE zombie-sesji (po 20260902b). CREATE OR REPLACE.
--
-- Problem: guard „jedna sesja naraz" + kotc_leave tylko w lobby = jeśli host
-- założy lobby i nie wystartuje, albo live nigdy nie dobije celu (ludzie się
-- rozejdą), user zostaje ZABLOKOWANY przed nową sesją. Naprawa:
--   • kotc_cleanup_stale() — kasuje martwe sesje (lobby > 2h bez startu; live > 2h
--     bez potwierdzenia). Wołane też na starcie create/join, żeby własna martwa
--     sesja nie blokowała.
--   • kotc_abandon(session) — host kończy/kasuje swoją sesję (lobby lub live).
--   • kotc_leave — teraz działa też w LIVE (bailujesz z runu → zwalniasz się).
--
-- Run once w Supabase → SQL Editor.
-- ============================================================================

-- ─── kotc_cleanup_stale — usuń martwe sesje (cascade sprząta drużyny/graczy/gierki) ─
create or replace function public.kotc_cleanup_stale()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.kotc_sessions
   where (status = 'lobby' and created_at        < now() - interval '2 hours')
      or (status = 'live'  and last_confirmed_at < now() - interval '2 hours');
end $$;

-- ─── kotc_abandon — host kończy/kasuje sesję ────────────────────────────────
create or replace function public.kotc_abandon(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_host uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select host_id, status into v_host, v_status from public.kotc_sessions where id = p_session_id;
  if not found then return; end if;
  if v_host <> auth.uid() then raise exception 'Tylko host może zakończyć sesję'; end if;
  if v_status = 'finished' then return; end if;
  delete from public.kotc_sessions where id = p_session_id;  -- cascade
end $$;

-- ─── kotc_leave — pozwól wyjść też z LIVE ───────────────────────────────────
create or replace function public.kotc_leave(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select status into v_status from public.kotc_sessions where id = p_session_id;
  if v_status = 'finished' then return; end if;
  delete from public.kotc_session_players where session_id = p_session_id and user_id = auth.uid();
end $$;

-- ─── create/join: sprzątnij martwe PRZED guardem „jedna sesja naraz" ─────────
create or replace function public.kotc_create_session(
  p_target int default 67, p_rotate_after int default 3, p_win_pts int default 15,
  p_streak3_bonus int default 5, p_team_size int default 3, p_min_teams int default 3, p_max_teams int default 6
) returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.kotc_sessions;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.kotc_cleanup_stale();
  if exists (select 1 from public.kotc_session_players sp join public.kotc_sessions ss on ss.id = sp.session_id
             where sp.user_id = auth.uid() and ss.status in ('lobby','live')) then
    raise exception 'Jesteś już w aktywnej sesji KotC — najpierw ją zakończ albo z niej wyjdź';
  end if;
  insert into public.kotc_sessions(code, host_id, target, rotate_after, win_pts, streak3_bonus, team_size, min_teams, max_teams)
  values (public.kotc_gen_code(), auth.uid(), p_target, p_rotate_after, p_win_pts, p_streak3_bonus, p_team_size, p_min_teams, p_max_teams)
  returning * into v_session;
  insert into public.kotc_session_players(session_id, user_id) values (v_session.id, auth.uid());
  return v_session;
end $$;

create or replace function public.kotc_join(p_code text)
returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.kotc_sessions; v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.kotc_cleanup_stale();
  if exists (select 1 from public.kotc_session_players sp join public.kotc_sessions ss on ss.id = sp.session_id
             where sp.user_id = auth.uid() and ss.status in ('lobby','live')) then
    raise exception 'Jesteś już w aktywnej sesji KotC — najpierw z niej wyjdź';
  end if;
  select * into v_session from public.kotc_sessions where code = upper(p_code);
  if not found then raise exception 'Nie znaleziono sesji o tym kodzie'; end if;
  if v_session.status <> 'lobby' then raise exception 'Sesja już wystartowała'; end if;
  select count(*) into v_count from public.kotc_session_players where session_id = v_session.id;
  if v_count >= v_session.max_teams * v_session.team_size then
    raise exception 'Lobby pełne (max % graczy)', v_session.max_teams * v_session.team_size;
  end if;
  insert into public.kotc_session_players(session_id, user_id) values (v_session.id, auth.uid())
  on conflict (session_id, user_id) do nothing;
  return v_session;
end $$;

-- ─── uprawnienia ────────────────────────────────────────────────────────────
revoke all on function public.kotc_cleanup_stale()   from public;
revoke all on function public.kotc_abandon(uuid)      from public;
grant execute on function public.kotc_cleanup_stale() to authenticated;
grant execute on function public.kotc_abandon(uuid)   to authenticated;
