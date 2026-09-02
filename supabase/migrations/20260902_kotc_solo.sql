-- ============================================================================
-- King of the Court — przebudowa na TRYB SOLO (bez klubów)
--
-- CO SIĘ ZMIENIA:
--   • Nie dołączasz klubem. Pojedynczy gracze wchodzą kodem, a `kotc_start`
--     LOSOWO dzieli ich na kolorowe drużyny po 3 (blue/green/red/orange/
--     purple/yellow). Winner-stays jak dotąd.
--   • Start tylko gdy liczba graczy dzieli się przez 3 i jest ≥ 3 drużyny (9).
--   • Wynik potwierdza DRUŻYNA CZEKAJĄCA (neutralni) — grający nie głosują.
--     Próg = większość neutralnych. To dlatego min = 3 drużyny (zawsze jest
--     ktoś neutralny).
--   • XP wg MIEJSCA w tabeli na koniec sesji (BEZ limitu dziennego) + wpis do
--     Draft Score (points_log source='kotc'). Licznik profiles.kotc_wins:
--     +1 dla mistrza sesji (na karcie).
--
-- ⚠️  DESTRUKCYJNE: usuwa stare tabele sesji KotC (klubowe). To dane efemeryczne
--     (gierki pickup), więc bezpieczne. ZOSTAJE: profiles.kotc_wins (licznik na
--     karcie) oraz kotc_xp_log (historia XP z KotC).
-- ⚠️  KONTRAKT RPC SIĘ ZMIENIA — front KotC (api.js, KotcOnline.jsx,
--     KingOfTheCourt.jsx, engine.js) trzeba zaktualizować w TYM SAMYM deployu,
--     inaczej KotC nie działa. To osobny, następny krok.
--
-- Run once w Supabase → SQL Editor, PO 20260902_xp_rebalance.sql.
-- ============================================================================

-- ─── 0. Zdejmij stare funkcje/tabele (kolejność wg zależności) ──────────────
drop trigger  if exists kotc_award_on_finish on public.kotc_sessions;
drop function if exists public.tg_kotc_award_on_finish() cascade;
drop function if exists public.kotc_cast_vote(uuid, uuid);
drop function if exists public.kotc_award_xp(uuid);
drop function if exists public.kotc_start(uuid);
drop function if exists public.kotc_join(text, uuid);
drop function if exists public.kotc_create_session(int,int,int,int,int,int,int,int);

drop table if exists public.kotc_mvp_votes    cascade;
drop table if exists public.kotc_game_votes   cascade;
drop table if exists public.kotc_games        cascade;
drop table if exists public.kotc_session_teams cascade;
drop table if exists public.kotc_sessions     cascade;  -- cascade zdejmie też FK z kotc_xp_log

-- kotc_xp_log ZOSTAJE (cap dzienny). Po dropie sesji jego FK znika — session_id
-- staje się luźnym uuid (historia), co nam wystarcza.

-- ─── 1. SESJE ───────────────────────────────────────────────────────────────
create table public.kotc_sessions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  host_id       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'lobby' check (status in ('lobby','live','finished')),
  -- config
  target        int  not null default 67,
  rotate_after  int  not null default 3,
  win_pts       int  not null default 15,
  streak3_bonus int  not null default 5,
  team_size     int  not null default 3,    -- 3v3
  min_teams     int  not null default 3,    -- floor: 3 drużyny (9 graczy)
  max_teams     int  not null default 6,    -- 6 kolorów
  -- stan silnika (queue = tablica kotc_session_teams.id, 1:1 z engine.js)
  king_team_id   uuid,
  streak         int not null default 0,
  queue          uuid[] not null default '{}',
  winner_team_id uuid,
  xp_awarded     boolean not null default false,
  created_at     timestamptz default now(),
  ended_at       timestamptz
);
create index idx_kotc_sessions_code on public.kotc_sessions(code);
create index idx_kotc_sessions_host on public.kotc_sessions(host_id);

-- ─── 2. DRUŻYNY SESJI (kolorowe, ad-hoc) ────────────────────────────────────
create table public.kotc_session_teams (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.kotc_sessions(id) on delete cascade,
  color       text not null check (color in ('blue','green','red','orange','purple','yellow')),
  queue_pos   int,
  score       int not null default 0,
  wins        int not null default 0,
  best_streak int not null default 0,
  unique (session_id, color)
);
create index idx_kotc_session_teams_session on public.kotc_session_teams(session_id);

-- FK stanu silnika → realne drużyny sesji (integralność zachowana)
alter table public.kotc_sessions
  add constraint kotc_sessions_king_fkey   foreign key (king_team_id)   references public.kotc_session_teams(id) on delete set null,
  add constraint kotc_sessions_winner_fkey foreign key (winner_team_id) references public.kotc_session_teams(id) on delete set null;

-- ─── 3. GRACZE SESJI (pula w lobby + przypisanie do drużyny po losowaniu) ────
create table public.kotc_session_players (
  session_id      uuid not null references public.kotc_sessions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  session_team_id uuid references public.kotc_session_teams(id) on delete set null,  -- null w lobby
  joined_at       timestamptz default now(),
  primary key (session_id, user_id)
);
create index idx_kotc_session_players_team on public.kotc_session_players(session_team_id);

-- ─── 4. GIERKI + GŁOSY ──────────────────────────────────────────────────────
create table public.kotc_games (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.kotc_sessions(id) on delete cascade,
  team_a         uuid not null references public.kotc_session_teams(id) on delete cascade,
  team_b         uuid not null references public.kotc_session_teams(id) on delete cascade,
  winner_team_id uuid references public.kotc_session_teams(id) on delete set null,
  status         text not null default 'voting' check (status in ('voting','confirmed')),
  created_at     timestamptz default now(),
  confirmed_at   timestamptz
);
create index idx_kotc_games_session on public.kotc_games(session_id, created_at);

create table public.kotc_game_votes (
  game_id       uuid not null references public.kotc_games(id) on delete cascade,
  voter_id      uuid not null references public.profiles(id) on delete cascade,
  voted_team_id uuid not null references public.kotc_session_teams(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (game_id, voter_id)
);

create table public.kotc_mvp_votes (
  session_id      uuid not null references public.kotc_sessions(id) on delete cascade,
  voter_id        uuid not null references public.profiles(id) on delete cascade,
  voted_player_id uuid not null references public.profiles(id),
  created_at      timestamptz default now(),
  primary key (session_id, voter_id)
);

-- ─── 5. RLS (twardą logikę robią RPC SECURITY DEFINER) ──────────────────────
alter table public.kotc_sessions        enable row level security;
alter table public.kotc_session_teams   enable row level security;
alter table public.kotc_session_players enable row level security;
alter table public.kotc_games           enable row level security;
alter table public.kotc_game_votes      enable row level security;
alter table public.kotc_mvp_votes       enable row level security;

-- czyta każdy zalogowany (dołączanie po kodzie); zapisy przez RPC (definer)
create policy "kotc read sessions"  on public.kotc_sessions        for select to authenticated using (true);
create policy "kotc host inserts"   on public.kotc_sessions        for insert to authenticated with check (host_id = auth.uid());
create policy "kotc host updates"   on public.kotc_sessions        for update to authenticated using (host_id = auth.uid());
create policy "kotc read teams"     on public.kotc_session_teams   for select to authenticated using (true);
create policy "kotc read players"   on public.kotc_session_players for select to authenticated using (true);
create policy "kotc read games"     on public.kotc_games           for select to authenticated using (true);
create policy "kotc read gvotes"    on public.kotc_game_votes      for select to authenticated using (true);
create policy "kotc read mvp"       on public.kotc_mvp_votes       for select to authenticated using (true);
create policy "kotc vote mvp"       on public.kotc_mvp_votes       for insert to authenticated with check (voter_id = auth.uid());

-- ─── 6. Realtime ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.kotc_sessions;
alter publication supabase_realtime add table public.kotc_session_teams;
alter publication supabase_realtime add table public.kotc_session_players;
alter publication supabase_realtime add table public.kotc_games;
alter publication supabase_realtime add table public.kotc_game_votes;

-- ─── 7. Generator kodu (jeśli nie istnieje po dropie — odtwórz) ─────────────
create or replace function public.kotc_gen_code()
returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1); end loop;
    exit when not exists (select 1 from public.kotc_sessions where code = c);
  end loop;
  return c;
end $$;

-- ============================================================================
-- RPC
-- ============================================================================

-- ─── kotc_create_session — host tworzy sesję i sam do niej wchodzi ──────────
create or replace function public.kotc_create_session(
  p_target        int default 67,
  p_rotate_after  int default 3,
  p_win_pts       int default 15,
  p_streak3_bonus int default 5,
  p_team_size     int default 3,
  p_min_teams     int default 3,
  p_max_teams     int default 6
) returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.kotc_sessions;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.kotc_sessions(code, host_id, target, rotate_after, win_pts, streak3_bonus, team_size, min_teams, max_teams)
  values (public.kotc_gen_code(), auth.uid(), p_target, p_rotate_after, p_win_pts, p_streak3_bonus, p_team_size, p_min_teams, p_max_teams)
  returning * into v_session;
  -- host jest graczem
  insert into public.kotc_session_players(session_id, user_id) values (v_session.id, auth.uid());
  return v_session;
end $$;

-- ─── kotc_join — gracz wchodzi SOLO kodem (bez klubu) ───────────────────────
create or replace function public.kotc_join(p_code text)
returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.kotc_sessions; v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_session from public.kotc_sessions where code = upper(p_code);
  if not found then raise exception 'Nie znaleziono sesji o tym kodzie'; end if;
  if v_session.status <> 'lobby' then raise exception 'Sesja już wystartowała'; end if;

  select count(*) into v_count from public.kotc_session_players where session_id = v_session.id;
  if v_count >= v_session.max_teams * v_session.team_size then
    raise exception 'Lobby pełne (max % graczy)', v_session.max_teams * v_session.team_size;
  end if;

  insert into public.kotc_session_players(session_id, user_id)
  values (v_session.id, auth.uid())
  on conflict (session_id, user_id) do nothing;
  return v_session;
end $$;

-- ─── kotc_leave — wyjście z lobby przed startem ─────────────────────────────
create or replace function public.kotc_leave(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select status into v_status from public.kotc_sessions where id = p_session_id;
  if v_status <> 'lobby' then raise exception 'Sesja już wystartowała — nie można wyjść'; end if;
  delete from public.kotc_session_players where session_id = p_session_id and user_id = auth.uid();
end $$;

-- ─── kotc_start — host startuje: walidacja %3, LOSOWE kolorowe drużyny ───────
create or replace function public.kotc_start(p_session_id uuid)
returns public.kotc_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_s        public.kotc_sessions;
  v_n        int;
  v_teams    int;
  v_colors   text[] := array['blue','green','red','orange','purple','yellow'];
  v_queue    uuid[];
begin
  select * into v_s from public.kotc_sessions where id = p_session_id;
  if not found then raise exception 'Sesja nie znaleziona'; end if;
  if v_s.host_id <> auth.uid() then raise exception 'Tylko host może wystartować'; end if;
  if v_s.status <> 'lobby' then raise exception 'Sesja już wystartowała'; end if;

  select count(*) into v_n from public.kotc_session_players where session_id = p_session_id;

  if v_n < v_s.min_teams * v_s.team_size then
    raise exception 'Potrzeba min. % graczy (% drużyny po %). Teraz: %',
      v_s.min_teams * v_s.team_size, v_s.min_teams, v_s.team_size, v_n;
  end if;
  if v_n % v_s.team_size <> 0 then
    raise exception 'Liczba graczy (%) musi dzielić się przez % — dołączcie jeszcze % albo % niech usiądą',
      v_n, v_s.team_size, (v_s.team_size - (v_n % v_s.team_size)), (v_n % v_s.team_size);
  end if;

  v_teams := v_n / v_s.team_size;
  if v_teams > v_s.max_teams then
    raise exception 'Za dużo graczy — max % drużyn (% graczy)', v_s.max_teams, v_s.max_teams * v_s.team_size;
  end if;

  -- utwórz drużyny (kolory po kolei, queue_pos = losowa kolejność startowa)
  insert into public.kotc_session_teams(session_id, color, queue_pos)
  select p_session_id, v_colors[i + 1], i
  from generate_series(0, v_teams - 1) as g(i);

  -- przypisz graczy LOSOWO: shuffle → kolejne trójki do kolejnych drużyn
  with shuffled as (
    select user_id, (row_number() over (order by random()) - 1) as rn
    from public.kotc_session_players where session_id = p_session_id
  ),
  teams as (
    select id, queue_pos from public.kotc_session_teams where session_id = p_session_id
  )
  update public.kotc_session_players sp
     set session_team_id = t.id
    from shuffled s
    join teams t on t.queue_pos = (s.rn / v_s.team_size)
   where sp.session_id = p_session_id and sp.user_id = s.user_id;

  -- kolejka = drużyny wg queue_pos; pierwsza para gra
  select array_agg(id order by queue_pos) into v_queue
    from public.kotc_session_teams where session_id = p_session_id;

  update public.kotc_sessions
     set status = 'live', king_team_id = null, streak = 0, queue = v_queue
   where id = p_session_id
   returning * into v_s;

  insert into public.kotc_games(session_id, team_a, team_b, status)
  values (p_session_id, v_queue[1], v_queue[2], 'voting');

  return v_s;
end $$;

-- ─── kotc_cast_vote — POTWIERDZA DRUŻYNA CZEKAJĄCA (neutralni), próg = większość ─
create or replace function public.kotc_cast_vote(p_game_id uuid, p_voted_team_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_game   public.kotc_games;
  v_s      public.kotc_sessions;
  v_neutral int;
  v_needed  int;
  v_votes   int;
  v_winner uuid; v_loser uuid; v_king uuid; v_streak int; v_queue uuid[];
  v_chall uuid; v_pts int; v_leader_score int; v_winner_team uuid; v_na uuid; v_nb uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_game from public.kotc_games where id = p_game_id;
  if not found then raise exception 'Gierka nie znaleziona'; end if;
  if v_game.status <> 'voting' then raise exception 'Głosowanie na tę gierkę jest zamknięte'; end if;
  select * into v_s from public.kotc_sessions where id = v_game.session_id;

  -- głosuje tylko NEUTRALNY (gracz sesji spoza dwóch drużyn na boisku)
  if not exists (
    select 1 from public.kotc_session_players sp
    where sp.session_id = v_s.id and sp.user_id = auth.uid()
      and sp.session_team_id is not null
      and sp.session_team_id not in (v_game.team_a, v_game.team_b)
  ) then
    raise exception 'Wynik potwierdza drużyna czekająca — grający nie głosują';
  end if;

  if p_voted_team_id not in (v_game.team_a, v_game.team_b) then
    raise exception 'Można głosować tylko na drużynę z tej gierki';
  end if;

  -- oddaj / zmień głos
  insert into public.kotc_game_votes(game_id, voter_id, voted_team_id)
  values (p_game_id, auth.uid(), p_voted_team_id)
  on conflict (game_id, voter_id) do update set voted_team_id = excluded.voted_team_id, created_at = now();

  -- próg = większość neutralnych dla TEJ gierki
  select count(*) into v_neutral from public.kotc_session_players sp
    where sp.session_id = v_s.id and sp.session_team_id is not null
      and sp.session_team_id not in (v_game.team_a, v_game.team_b);
  v_needed := v_neutral / 2 + 1;

  select count(*) into v_votes
    from public.kotc_game_votes where game_id = p_game_id and voted_team_id = p_voted_team_id;
  if v_votes < v_needed then
    return jsonb_build_object('status','voting','votes',v_votes,'needed',v_needed);
  end if;

  -- ── PRÓG → potwierdź + krok silnika (winner-stays, 1:1 z engine.js) ──
  v_winner := p_voted_team_id;
  v_loser  := case when v_game.team_a = v_winner then v_game.team_b else v_game.team_a end;
  v_king := v_s.king_team_id; v_streak := v_s.streak; v_queue := v_s.queue;

  if v_king is null then
    v_queue := array_remove(array_remove(v_queue, v_winner), v_loser);
    update public.kotc_session_teams set score = score + v_s.win_pts, wins = wins + 1, best_streak = greatest(best_streak, 1)
      where id = v_winner;
    v_king := v_winner; v_streak := 1; v_queue := v_queue || v_loser;
  else
    v_chall := v_queue[1]; v_queue := v_queue[2:];
    if v_winner = v_king then
      v_streak := v_streak + 1;
      v_pts := v_s.win_pts + case when v_streak = v_s.rotate_after then v_s.streak3_bonus else 0 end;
      update public.kotc_session_teams set score = score + v_pts, wins = wins + 1, best_streak = greatest(best_streak, v_streak)
        where id = v_king;
      v_queue := v_queue || v_chall;
      if v_streak >= v_s.rotate_after then v_queue := v_queue || v_king; v_king := null; v_streak := 0; end if;
    else
      update public.kotc_session_teams set score = score + v_s.win_pts, wins = wins + 1, best_streak = greatest(best_streak, 1)
        where id = v_winner;
      v_queue := v_queue || v_king; v_king := v_winner; v_streak := 1;
    end if;
  end if;

  update public.kotc_games set status = 'confirmed', winner_team_id = v_winner, confirmed_at = now() where id = p_game_id;
  update public.kotc_sessions set king_team_id = v_king, streak = v_streak, queue = v_queue where id = v_s.id;

  -- cel osiągnięty?
  select max(score) into v_leader_score from public.kotc_session_teams where session_id = v_s.id;
  if v_leader_score >= v_s.target then
    select id into v_winner_team from public.kotc_session_teams where session_id = v_s.id order by score desc, wins desc limit 1;
    update public.kotc_sessions set status = 'finished', winner_team_id = v_winner_team, ended_at = now() where id = v_s.id;
    return jsonb_build_object('status','finished','winner_team',v_winner_team);
  end if;

  -- następna gierka
  if v_king is null then v_na := v_queue[1]; v_nb := v_queue[2];
  else v_na := v_king; v_nb := v_queue[1]; end if;
  insert into public.kotc_games(session_id, team_a, team_b, status) values (v_s.id, v_na, v_nb, 'voting');
  return jsonb_build_object('status','confirmed','winner',v_winner,'next_game',jsonb_build_array(v_na,v_nb));
end $$;

-- ─── kotc_award_xp — XP wg MIEJSCA + Draft Score + kotc_wins ─
create or replace function public.kotc_award_xp(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_s     public.kotc_sessions;
  r       record;
  v_xp    int;
  v_draft int;
begin
  select * into v_s from public.kotc_sessions where id = p_session_id;
  if v_s.id is null or v_s.status <> 'finished' or v_s.xp_awarded then return; end if;

  for r in
    with ranked as (
      select id, rank() over (order by score desc, wins desc) as place
      from public.kotc_session_teams where session_id = p_session_id
    )
    select sp.user_id as uid, rk.place
    from public.kotc_session_players sp
    join ranked rk on rk.id = sp.session_team_id
    where sp.session_id = p_session_id and sp.session_team_id is not null
  loop
    -- XP: udział 75 + bonus za miejsce
    v_xp := 75 + case r.place when 1 then 200 when 2 then 120 when 3 then 70 when 4 then 40 else 20 end;
    perform public.add_player_xp(r.uid, v_xp);
    insert into public.kotc_xp_log(user_id, session_id, amount) values (r.uid, p_session_id, v_xp);

    -- Draft Score (tygodniowy ranking) — KotC też rusza licznik, jak mecze
    v_draft := case r.place when 1 then 120 when 2 then 70 when 3 then 40 when 4 then 25 else 10 end;
    insert into public.points_log(user_id, training_id, points, week_number, date, source)
    values (r.uid, null, v_draft, public.calendar_week_number(current_date), current_date, 'kotc');

    -- licznik wygranych na karcie — tylko mistrz sesji
    if r.place = 1 then
      update public.profiles set kotc_wins = coalesce(kotc_wins, 0) + 1 where id = r.uid;
    end if;
  end loop;

  update public.kotc_sessions set xp_awarded = true where id = p_session_id;
end $$;

-- trigger: sesja → finished → rozdaj XP
create or replace function public.tg_kotc_award_on_finish()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished') then
    perform public.kotc_award_xp(new.id);
  end if;
  return new;
end $$;

drop trigger if exists kotc_award_on_finish on public.kotc_sessions;
create trigger kotc_award_on_finish
  after update on public.kotc_sessions
  for each row execute function public.tg_kotc_award_on_finish();

-- ─── uprawnienia ────────────────────────────────────────────────────────────
revoke all on function public.kotc_create_session(int,int,int,int,int,int,int) from public;
revoke all on function public.kotc_join(text)   from public;
revoke all on function public.kotc_leave(uuid)  from public;
revoke all on function public.kotc_start(uuid)  from public;
revoke all on function public.kotc_cast_vote(uuid,uuid) from public;
grant execute on function public.kotc_create_session(int,int,int,int,int,int,int) to authenticated;
grant execute on function public.kotc_join(text)   to authenticated;
grant execute on function public.kotc_leave(uuid)  to authenticated;
grant execute on function public.kotc_start(uuid)  to authenticated;
grant execute on function public.kotc_cast_vote(uuid,uuid) to authenticated;
-- kotc_award_xp NIE jest nadawane klientom (odpala je tylko trigger).
revoke all on function public.kotc_award_xp(uuid) from public, authenticated, anon;
