-- ============================================================================
-- KotC solo — KANONICZNA warstwa funkcji. IDEMPOTENTNA — odpalaj ile razy chcesz.
--
-- ZASTĘPUJE (i usuwa potrzebę) 20260902b / 20260902c / 20260902d. Te trzy pliki
-- warstwowały CREATE OR REPLACE na tych samych funkcjach z ukrytą kolejnością —
-- pominięcie jednego (tak stało się z `c`) dawało ciche awarie w stylu
-- "function kotc_cleanup_stale() does not exist". Ten plik jest JEDYNYM źródłem
-- prawdy dla funkcji KotC: każdą definiuje w postaci końcowej, bez zależności od
-- tego, które wcześniejsze migracje poszły na bazę.
--
-- WYMAGA tabel z 20260902_kotc_solo.sql (kotc_sessions, kotc_session_teams,
-- kotc_session_players, kotc_games, kotc_game_votes, kotc_mvp_votes,
-- kotc_gen_code(), kotc_award_xp) — to jednorazowy schemat, ten plik go nie rusza.
--
-- Zasady gry (stan końcowy):
--   • solo: wchodzisz kodem, host startuje, losowe kolorowe drużyny po 3 (%3, ≥3 drużyny)
--   • wynik potwierdza WYŁĄCZNIE drużyna czekająca (neutralni); grający nie głosują
--   • próg = confirm_votes ustawiony przez hosta, clamp do liczby neutralnych
--   • cooldown vote_cooldown_sec (180 s) od ostatniej zmiany składu na boisku
--   • punktacja MOMENTUM: obrona króla 12/14/16, upset 12+2*seria, król schodzi po rotate_after
--   • sprzątanie martwych sesji (lobby >2h / live >2h bez potwierdzenia) przed create/join
--   • host może zakończyć sesję (abandon), gracz może wyjść także w LIVE
--
-- Run w Supabase → SQL Editor.
-- ============================================================================

-- ─── 0. Kolumny stanu (idempotentnie) ───────────────────────────────────────
alter table public.kotc_sessions
  add column if not exists momentum          int         not null default 0,
  add column if not exists last_confirmed_at timestamptz not null default now(),
  add column if not exists vote_cooldown_sec int         not null default 180,
  add column if not exists confirm_votes     int         not null default 2;

-- ─── 1. kotc_cleanup_stale — kasuj martwe sesje (cascade sprząta resztę) ────
create or replace function public.kotc_cleanup_stale()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.kotc_sessions
   where (status = 'lobby' and created_at        < now() - interval '2 hours')
      or (status = 'live'  and last_confirmed_at < now() - interval '2 hours');
end $$;

-- ─── 2. kotc_abandon — host kończy/kasuje sesję (lobby lub live) ────────────
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

-- ─── 3. kotc_leave — gracz wychodzi (także w LIVE) ──────────────────────────
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

-- ─── 4. kotc_create_session — host tworzy; próg potwierdzeń ustawia sam ──────
-- Drop obu możliwych starych podpisów (7-arg solo, 8-arg klubowy z innymi nazwami
-- parametrów) — CREATE OR REPLACE nie umie zmienić nazw parametrów (42P13).
drop function if exists public.kotc_create_session(int, int, int, int, int, int, int);
drop function if exists public.kotc_create_session(int, int, int, int, int, int, int, int);

create function public.kotc_create_session(
  p_target int default 67, p_rotate_after int default 3, p_win_pts int default 15,
  p_streak3_bonus int default 5, p_team_size int default 3, p_min_teams int default 3,
  p_max_teams int default 6, p_confirm_votes int default 2
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
  insert into public.kotc_sessions(code, host_id, target, rotate_after, win_pts, streak3_bonus, team_size, min_teams, max_teams, confirm_votes)
  values (public.kotc_gen_code(), auth.uid(), p_target, p_rotate_after, p_win_pts, p_streak3_bonus, p_team_size, p_min_teams, p_max_teams, greatest(1, p_confirm_votes))
  returning * into v_session;
  insert into public.kotc_session_players(session_id, user_id) values (v_session.id, auth.uid());
  return v_session;
end $$;

-- ─── 5. kotc_join — dołącz SOLO kodem ───────────────────────────────────────
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

-- ─── 6. kotc_start — host startuje: losowe kolorowe drużyny, cooldown od losowania ─
create or replace function public.kotc_start(p_session_id uuid)
returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_s public.kotc_sessions; v_n int; v_teams int;
  v_colors text[] := array['blue','green','red','orange','purple','yellow']; v_queue uuid[];
begin
  select * into v_s from public.kotc_sessions where id = p_session_id;
  if not found then raise exception 'Sesja nie znaleziona'; end if;
  if v_s.host_id <> auth.uid() then raise exception 'Tylko host może wystartować'; end if;
  if v_s.status <> 'lobby' then raise exception 'Sesja już wystartowała'; end if;

  select count(*) into v_n from public.kotc_session_players where session_id = p_session_id;
  if v_n < v_s.min_teams * v_s.team_size then
    raise exception 'Potrzeba min. % graczy (% drużyny po %). Teraz: %', v_s.min_teams * v_s.team_size, v_s.min_teams, v_s.team_size, v_n;
  end if;
  if v_n % v_s.team_size <> 0 then
    raise exception 'Liczba graczy (%) musi dzielić się przez % — dołączcie jeszcze % albo % niech usiądą',
      v_n, v_s.team_size, (v_s.team_size - (v_n % v_s.team_size)), (v_n % v_s.team_size);
  end if;
  v_teams := v_n / v_s.team_size;
  if v_teams > v_s.max_teams then raise exception 'Za dużo graczy — max % drużyn (% graczy)', v_s.max_teams, v_s.max_teams * v_s.team_size; end if;

  insert into public.kotc_session_teams(session_id, color, queue_pos)
  select p_session_id, v_colors[i + 1], i from generate_series(0, v_teams - 1) as g(i);

  with shuffled as (
    select user_id, (row_number() over (order by random()) - 1) as rn
    from public.kotc_session_players where session_id = p_session_id
  ), teams as (
    select id, queue_pos from public.kotc_session_teams where session_id = p_session_id
  )
  update public.kotc_session_players sp set session_team_id = t.id
    from shuffled s join teams t on t.queue_pos = (s.rn / v_s.team_size)
   where sp.session_id = p_session_id and sp.user_id = s.user_id;

  select array_agg(id order by queue_pos) into v_queue from public.kotc_session_teams where session_id = p_session_id;

  update public.kotc_sessions
     set status = 'live', king_team_id = null, streak = 0, momentum = 0, queue = v_queue, last_confirmed_at = now()
   where id = p_session_id returning * into v_s;

  insert into public.kotc_games(session_id, team_a, team_b, status) values (p_session_id, v_queue[1], v_queue[2], 'voting');
  return v_s;
end $$;

-- ─── 7. kotc_cast_vote — neutralni potwierdzają; próg hosta; cooldown; momentum ─
create or replace function public.kotc_cast_vote(p_game_id uuid, p_voted_team_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_game public.kotc_games; v_s public.kotc_sessions;
  v_neutral int; v_needed int; v_votes int; v_locked int;
  v_winner uuid; v_loser uuid; v_king uuid; v_streak int; v_mom int; v_queue uuid[];
  v_chall uuid; v_pts int; v_leader_score int; v_winner_team uuid; v_na uuid; v_nb uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_game from public.kotc_games where id = p_game_id;
  if not found then raise exception 'Gierka nie znaleziona'; end if;
  if v_game.status <> 'voting' then raise exception 'Głosowanie na tę gierkę jest zamknięte'; end if;
  select * into v_s from public.kotc_sessions where id = v_game.session_id;

  -- COOLDOWN: min. vote_cooldown_sec od ostatniej zmiany składu na boisku
  if now() < v_s.last_confirmed_at + make_interval(secs => v_s.vote_cooldown_sec) then
    v_locked := ceil(extract(epoch from (v_s.last_confirmed_at + make_interval(secs => v_s.vote_cooldown_sec) - now())))::int;
    raise exception 'Głosowanie odblokuje się za %s s (min. % min od zmiany składu na boisku)', v_locked, round(v_s.vote_cooldown_sec / 60.0);
  end if;

  -- głosuje tylko NEUTRALNY (gracz sesji spoza dwóch drużyn na boisku)
  if not exists (
    select 1 from public.kotc_session_players sp
    where sp.session_id = v_s.id and sp.user_id = auth.uid()
      and sp.session_team_id is not null and sp.session_team_id not in (v_game.team_a, v_game.team_b)
  ) then raise exception 'Wynik potwierdza drużyna czekająca — grający nie głosują'; end if;

  if p_voted_team_id not in (v_game.team_a, v_game.team_b) then raise exception 'Można głosować tylko na drużynę z tej gierki'; end if;

  insert into public.kotc_game_votes(game_id, voter_id, voted_team_id)
  values (p_game_id, auth.uid(), p_voted_team_id)
  on conflict (game_id, voter_id) do update set voted_team_id = excluded.voted_team_id, created_at = now();

  select count(*) into v_neutral from public.kotc_session_players sp
    where sp.session_id = v_s.id and sp.session_team_id is not null and sp.session_team_id not in (v_game.team_a, v_game.team_b);
  -- PRÓG = ustawiony przez hosta, ale nigdy więcej niż liczba neutralnych (brak zakleszczenia)
  v_needed := greatest(1, least(v_s.confirm_votes, v_neutral));

  select count(*) into v_votes from public.kotc_game_votes where game_id = p_game_id and voted_team_id = p_voted_team_id;
  if v_votes < v_needed then
    return jsonb_build_object('status','voting','votes',v_votes,'needed',v_needed);
  end if;

  -- ── PRÓG → potwierdź + krok silnika (winner-stays) z MOMENTUM ──
  v_winner := p_voted_team_id;
  v_loser  := case when v_game.team_a = v_winner then v_game.team_b else v_game.team_a end;
  v_king := v_s.king_team_id; v_streak := v_s.streak; v_mom := v_s.momentum; v_queue := v_s.queue;

  if v_king is null then
    v_queue := array_remove(array_remove(v_queue, v_winner), v_loser);
    v_mom := 1; v_pts := 10 + 2 * v_mom;                                        -- koronacja → 12
    update public.kotc_session_teams set score = score + v_pts, wins = wins + 1, best_streak = greatest(best_streak, 1) where id = v_winner;
    v_king := v_winner; v_streak := 1; v_queue := v_queue || v_loser;
  else
    v_chall := v_queue[1]; v_queue := v_queue[2:];
    if v_winner = v_king then
      v_streak := v_streak + 1; v_mom := v_mom + 1; v_pts := 10 + 2 * v_mom;    -- obrona → 14, 16…
      update public.kotc_session_teams set score = score + v_pts, wins = wins + 1, best_streak = greatest(best_streak, v_streak) where id = v_king;
      v_queue := v_queue || v_chall;
      if v_streak >= v_s.rotate_after then v_queue := v_queue || v_king; v_king := null; v_streak := 0; v_mom := 0; end if;
    else
      v_pts := 12 + 2 * v_streak;                                               -- upset → 14 (seria1) / 16 (seria2)
      update public.kotc_session_teams set score = score + v_pts, wins = wins + 1, best_streak = greatest(best_streak, 1) where id = v_winner;
      v_queue := v_queue || v_king; v_king := v_winner; v_streak := 1; v_mom := 0;
    end if;
  end if;

  update public.kotc_games set status = 'confirmed', winner_team_id = v_winner, confirmed_at = now() where id = p_game_id;
  -- last_confirmed_at = now() → nowy cooldown na kolejną gierkę
  update public.kotc_sessions
     set king_team_id = v_king, streak = v_streak, momentum = v_mom, queue = v_queue, last_confirmed_at = now()
   where id = v_s.id;

  select max(score) into v_leader_score from public.kotc_session_teams where session_id = v_s.id;
  if v_leader_score >= v_s.target then
    select id into v_winner_team from public.kotc_session_teams where session_id = v_s.id order by score desc, wins desc limit 1;
    update public.kotc_sessions set status = 'finished', winner_team_id = v_winner_team, ended_at = now() where id = v_s.id;
    return jsonb_build_object('status','finished','winner_team',v_winner_team);
  end if;

  if v_king is null then v_na := v_queue[1]; v_nb := v_queue[2]; else v_na := v_king; v_nb := v_queue[1]; end if;
  insert into public.kotc_games(session_id, team_a, team_b, status) values (v_s.id, v_na, v_nb, 'voting');
  return jsonb_build_object('status','confirmed','winner',v_winner,'next_game',jsonb_build_array(v_na,v_nb));
end $$;

-- ─── 8. kotc_vote_mvp — głos MVP po zakończeniu sesji ───────────────────────
create or replace function public.kotc_vote_mvp(p_session_id uuid, p_player_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text; v_mvp uuid; v_cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select status into v_status from public.kotc_sessions where id = p_session_id;
  if not found then raise exception 'Sesja nie znaleziona'; end if;
  if v_status <> 'finished' then raise exception 'MVP głosuje się po zakończeniu sesji'; end if;
  if not exists (select 1 from public.kotc_session_players where session_id = p_session_id and user_id = auth.uid()) then
    raise exception 'Tylko uczestnicy sesji głosują na MVP'; end if;
  if not exists (select 1 from public.kotc_session_players where session_id = p_session_id and user_id = p_player_id) then
    raise exception 'Można głosować tylko na gracza z tej sesji'; end if;
  insert into public.kotc_mvp_votes(session_id, voter_id, voted_player_id)
  values (p_session_id, auth.uid(), p_player_id)
  on conflict (session_id, voter_id) do update set voted_player_id = excluded.voted_player_id, created_at = now();
  select voted_player_id, count(*) into v_mvp, v_cnt from public.kotc_mvp_votes
    where session_id = p_session_id group by voted_player_id order by count(*) desc limit 1;
  return jsonb_build_object('mvp', v_mvp, 'votes', v_cnt);
end $$;

-- ─── 9. Uprawnienia — tylko zalogowani wołają RPC ───────────────────────────
revoke all on function public.kotc_cleanup_stale()                                        from public;
revoke all on function public.kotc_abandon(uuid)                                           from public;
revoke all on function public.kotc_leave(uuid)                                             from public;
revoke all on function public.kotc_create_session(int, int, int, int, int, int, int, int)  from public;
revoke all on function public.kotc_join(text)                                              from public;
revoke all on function public.kotc_start(uuid)                                             from public;
revoke all on function public.kotc_cast_vote(uuid, uuid)                                   from public;
revoke all on function public.kotc_vote_mvp(uuid, uuid)                                    from public;

grant execute on function public.kotc_cleanup_stale()                                        to authenticated;
grant execute on function public.kotc_abandon(uuid)                                           to authenticated;
grant execute on function public.kotc_leave(uuid)                                             to authenticated;
grant execute on function public.kotc_create_session(int, int, int, int, int, int, int, int)  to authenticated;
grant execute on function public.kotc_join(text)                                              to authenticated;
grant execute on function public.kotc_start(uuid)                                             to authenticated;
grant execute on function public.kotc_cast_vote(uuid, uuid)                                   to authenticated;
grant execute on function public.kotc_vote_mvp(uuid, uuid)                                    to authenticated;
