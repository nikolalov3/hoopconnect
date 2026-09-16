-- ============================================================================
-- Panel trenera: ręczny (ghost) roster + płatności (składki + inne) + statystyki.
--   • team_manual_players — zawodnicy dodani ręcznie, bez konta w apce
--   • team_fee_settings   — kwota składki (jedna na drużynę)
--   • team_payments       — księga: składki + inne płatności, status pending/paid
-- RLS: dostęp tylko trener-właściciel drużyny (teams.coach_id = auth.uid()),
-- spójnie z istniejącymi politykami panelu trenera (20260511_coach_panel*).
-- Idempotentna (create ... if not exists + drop policy if exists). Waluta: PLN.
-- ============================================================================

-- ─── 1. Zawodnicy ręczni (ghost, bez konta) ─────────────────────────────────
create table if not exists public.team_manual_players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  birth_date    date,
  jersey_number int,
  created_at    timestamptz default now()
);
create index if not exists idx_team_manual_players_team on public.team_manual_players(team_id);

-- ─── 2. Ustawienia składki (jedna na drużynę) ───────────────────────────────
create table if not exists public.team_fee_settings (
  team_id    uuid primary key references public.teams(id) on delete cascade,
  amount     numeric(10,2) not null default 0,
  active     boolean not null default true,
  note       text,
  updated_at timestamptz default now()
);

-- ─── 3. Księga płatności ────────────────────────────────────────────────────
-- member_id = zawodnik z kontem (profiles), manual_id = ghost. Co najwyżej jeden
-- z nich (płatność per zawodnik); oba null = płatność ogólna drużyny.
create table if not exists public.team_payments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  member_id  uuid references public.profiles(id) on delete set null,
  manual_id  uuid references public.team_manual_players(id) on delete cascade,
  title      text not null,
  category   text not null check (category in ('skladka','inne')),
  amount     numeric(10,2) not null,
  period     text,                       -- 'YYYY-MM' (tylko składka)
  status     text not null default 'pending' check (status in ('pending','paid')),
  due_date   date,
  paid_at    timestamptz,
  created_at timestamptz default now(),
  constraint team_payments_one_subject check (member_id is null or manual_id is null)
);
create index if not exists idx_team_payments_team_status on public.team_payments(team_id, status);
create index if not exists idx_team_payments_team_period on public.team_payments(team_id, period);

-- Idempotentne „Wystaw składkę za miesiąc": brak duplikatów per okres+zawodnik.
create unique index if not exists uniq_skladka_member
  on public.team_payments(team_id, period, member_id)
  where category = 'skladka' and member_id is not null;
create unique index if not exists uniq_skladka_manual
  on public.team_payments(team_id, period, manual_id)
  where category = 'skladka' and manual_id is not null;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
alter table public.team_manual_players enable row level security;
alter table public.team_fee_settings   enable row level security;
alter table public.team_payments        enable row level security;

drop policy if exists team_manual_players_coach on public.team_manual_players;
create policy team_manual_players_coach on public.team_manual_players for all
  using      (team_id in (select id from public.teams where coach_id = auth.uid()))
  with check (team_id in (select id from public.teams where coach_id = auth.uid()));

drop policy if exists team_fee_settings_coach on public.team_fee_settings;
create policy team_fee_settings_coach on public.team_fee_settings for all
  using      (team_id in (select id from public.teams where coach_id = auth.uid()))
  with check (team_id in (select id from public.teams where coach_id = auth.uid()));

drop policy if exists team_payments_coach on public.team_payments;
create policy team_payments_coach on public.team_payments for all
  using      (team_id in (select id from public.teams where coach_id = auth.uid()))
  with check (team_id in (select id from public.teams where coach_id = auth.uid()));
