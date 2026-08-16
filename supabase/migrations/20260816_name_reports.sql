-- ── name_reports ──────────────────────────────────────────────────────────────
-- Reaktywna połowa moderacji nazw (Apple 1.2 UGC): gracze mogą zgłosić
-- nieodpowiednią nazwę innego gracza. Zgłoszenia przeglądasz w Supabase
-- (Table editor / SQL) i reagujesz: wymuś zmianę nazwy albo zbanuj.
--
-- Uruchom w Supabase → SQL Editor.

create table if not exists public.name_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reported_name    text not null,
  context          text,                              -- np. 'club_roster'
  status           text not null default 'open',      -- open | reviewed | dismissed
  created_at       timestamptz not null default now(),
  -- jedno zgłoszenie na parę (reporter, zgłoszony) — blokuje spam
  unique (reporter_id, reported_user_id)
);

create index if not exists name_reports_status_idx on public.name_reports (status, created_at desc);

alter table public.name_reports enable row level security;

-- Zalogowany user może DODAĆ zgłoszenie tylko jako on sam (reporter).
drop policy if exists "name_reports insert own" on public.name_reports;
create policy "name_reports insert own" on public.name_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- Brak policy SELECT/UPDATE/DELETE = przez API nikt zgłoszeń nie czyta ani nie
-- edytuje. Przeglądasz je w dashboardzie (service_role omija RLS).
