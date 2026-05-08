-- ============================================================
--  HoopConnect — Matches feature
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. club_matches ───────────────────────────────────────────
create table if not exists public.club_matches (
  id            uuid          primary key default gen_random_uuid(),

  -- creator
  club_id       uuid          not null references public.clubs(id)    on delete cascade,
  created_by    uuid          not null references public.profiles(id),

  -- game mode
  mode          text          not null check (mode in ('2v2','3v3','5v5')),

  -- location
  lat           double precision not null,
  lng           double precision not null,
  address       text,

  -- schedule
  scheduled_at  timestamptz   not null,
  note          text,

  -- lifecycle
  status        text          not null default 'open'
                              check (status in ('open','full','completed','cancelled')),

  -- result (filled after match ends)
  score_home    int           check (score_home >= 0),
  score_away    int           check (score_away >= 0),

  created_at    timestamptz   not null default now()
);

-- ── 2. match_players ──────────────────────────────────────────
create table if not exists public.match_players (
  id         uuid        primary key default gen_random_uuid(),
  match_id   uuid        not null references public.club_matches(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id),
  team       text        not null check (team in ('home','away')),
  slot       int         not null check (slot between 1 and 5),
  joined_at  timestamptz not null default now(),

  -- one player per match, one player per slot
  unique (match_id, user_id),
  unique (match_id, team, slot)
);

-- ── 3. Indexes ────────────────────────────────────────────────
create index if not exists idx_matches_club       on public.club_matches(club_id);
create index if not exists idx_matches_scheduled  on public.club_matches(scheduled_at);
create index if not exists idx_matches_status     on public.club_matches(status);
create index if not exists idx_mp_match           on public.match_players(match_id);
create index if not exists idx_mp_user            on public.match_players(user_id);

-- ── 4. Row-Level Security ─────────────────────────────────────
alter table public.club_matches   enable row level security;
alter table public.match_players  enable row level security;

-- club_matches: anyone logged in can read;
--               only creator can insert / delete;
--               creator OR any participant can update (score entry)
create policy "matches_select"
  on public.club_matches for select
  using (auth.uid() is not null);

create policy "matches_insert"
  on public.club_matches for insert
  with check (auth.uid() = created_by);

create policy "matches_update"
  on public.club_matches for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.match_players
      where match_id = id
        and user_id  = auth.uid()
    )
  );

create policy "matches_delete"
  on public.club_matches for delete
  using (auth.uid() = created_by);

-- match_players: anyone logged in can read;
--                users can only insert / delete their own row
create policy "mp_select"
  on public.match_players for select
  using (auth.uid() is not null);

create policy "mp_insert"
  on public.match_players for insert
  with check (auth.uid() = user_id);

create policy "mp_delete"
  on public.match_players for delete
  using (auth.uid() = user_id);
