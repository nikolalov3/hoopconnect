-- ============================================================
--  HoopConnect — Club feature
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. clubs ─────────────────────────────────────────────────
create table if not exists public.clubs (
  id           uuid        primary key default gen_random_uuid(),

  -- identity
  name         text        not null check (char_length(name) between 3 and 30),
  abbr         text        not null check (char_length(abbr) between 2 and 3),

  -- country (all three fields stored so we never need a lookup table)
  country_code text        not null,   -- 'PL'
  country_name text        not null,   -- 'Polska'
  country_flag text        not null,   -- '🇵🇱'

  -- ownership
  owner_id     uuid        not null references public.profiles(id) on delete cascade,

  created_at   timestamptz not null default now()
);

-- ── 2. club_members ──────────────────────────────────────────
create table if not exists public.club_members (
  id          uuid        primary key default gen_random_uuid(),
  club_id     uuid        not null references public.clubs(id)    on delete cascade,
  user_id     uuid                     references public.profiles(id) on delete set null,

  position    text        not null check (position in ('PG','SG','SF','C','PF')),

  -- optional: slot reserved for an uninvited player (link-invite)
  invite_token text unique,

  joined_at   timestamptz not null default now(),

  -- one position per club, one player per club
  unique (club_id, position),
  unique (club_id, user_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────
create index if not exists idx_clubs_owner      on public.clubs(owner_id);
create index if not exists idx_members_club     on public.club_members(club_id);
create index if not exists idx_members_user     on public.club_members(user_id);

-- ── 4. Row-Level Security ─────────────────────────────────────

alter table public.clubs         enable row level security;
alter table public.club_members  enable row level security;

-- clubs: anyone logged in can read; only owner can write
create policy "clubs_select"
  on public.clubs for select
  using (auth.uid() is not null);

create policy "clubs_insert"
  on public.clubs for insert
  with check (owner_id = auth.uid());

create policy "clubs_update"
  on public.clubs for update
  using (owner_id = auth.uid());

create policy "clubs_delete"
  on public.clubs for delete
  using (owner_id = auth.uid());

-- members: anyone logged in can read;
--          only club owner can insert/update/delete slots
create policy "members_select"
  on public.club_members for select
  using (auth.uid() is not null);

create policy "members_insert"
  on public.club_members for insert
  with check (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_id = auth.uid()
    )
  );

create policy "members_update"
  on public.club_members for update
  using (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_id = auth.uid()
    )
  );

create policy "members_delete"
  on public.club_members for delete
  using (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_id = auth.uid()
    )
  );

-- ── 5. Helper view (optional, convenient for the app) ─────────
-- Returns a club with all 5 slots (including empty ones) in one query
create or replace view public.club_roster as
select
  c.id            as club_id,
  c.name          as club_name,
  c.abbr,
  c.country_code,
  c.country_name,
  c.country_flag,
  c.owner_id,
  c.created_at,
  cm.id           as member_id,
  cm.position,
  cm.user_id,
  p.name          as player_name
from public.clubs c
left join public.club_members cm on cm.club_id = c.id
left join public.profiles      p  on p.id = cm.user_id;
