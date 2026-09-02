-- ============================================================================
-- KotC solo — HOST USTAWIA LICZBĘ POTWIERDZEŃ (decyzja UX 2026-09-02).
-- Zamiast automatu „większość neutralnych" host wybiera przy tworzeniu, ile
-- głosów czekającej drużyny zamyka gierkę (suwak we froncie). Głosują NADAL
-- tylko neutralni (grający nie głosują) — host steruje wyłącznie progiem.
--
--   • kotc_sessions.confirm_votes (int, default 2) — próg ustawiony przez hosta.
--   • kotc_create_session(+p_confirm_votes) — zapisuje próg (drop starego 7-arg
--     podpisu → create 8-arg, żeby PostgREST nie miał dwóch kandydatów).
--   • kotc_cast_vote — v_needed = greatest(1, least(confirm_votes, neutralni)).
--     Clamp do liczby neutralnych = przy 3 druzynach (3 czekających) próg > 3
--     nie zakleszcza gry. Reszta (cooldown, neutral-only, momentum) BEZ zmian.
--
-- Run once w Supabase → SQL Editor (po 20260902 / b / c).
-- ============================================================================

-- ─── 0. Kolumna progu ───────────────────────────────────────────────────────
alter table public.kotc_sessions
  add column if not exists confirm_votes int not null default 2;

-- ─── 1. kotc_create_session — + p_confirm_votes (drop 7-arg, create 8-arg) ──
drop function if exists public.kotc_create_session(int, int, int, int, int, int, int);

create or replace function public.kotc_create_session(
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

grant execute on function public.kotc_create_session(int, int, int, int, int, int, int, int) to authenticated;

-- ─── 2. kotc_cast_vote — próg = host confirm_votes (clamp do neutralnych) ────
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
