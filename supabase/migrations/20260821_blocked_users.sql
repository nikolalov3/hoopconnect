-- ────────────────────────────────────────────────────────────────────────────
-- User blocking (Apple App Store Guideline 1.2 — UGC apps must let users block
-- abusive users). Each row = "blocker no longer wants to see blocked".
-- FK on delete cascade to auth.users → account deletion clears blocks both ways
-- (so public.delete_account() needs no extra handling for this table).
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocked_by_blocker on public.blocked_users(blocker_id);

alter table public.blocked_users enable row level security;

-- You can only see and manage your OWN blocks.
create policy "blocked_select" on public.blocked_users
  for select using (auth.uid() = blocker_id);

create policy "blocked_insert" on public.blocked_users
  for insert with check (auth.uid() = blocker_id);

create policy "blocked_delete" on public.blocked_users
  for delete using (auth.uid() = blocker_id);
