-- ============================================================================
-- Profiles privacy — STEP B of 2: the lockdown. RUN THIS ONLY AFTER step A has
-- run AND the new build (which reads other users from public_profiles) is live.
--
-- BEFORE: `profiles` had a world-readable SELECT policy (using true), so anyone
-- with the public anon key (it ships in the app bundle) could read EVERY column
-- of EVERY user — age + birth data (many users are young), city/country,
-- last_seen, and the INTERNAL anti-cheat fields (fraud_probability /
-- fraud_flagged_at). Not a credential leak (emails/passwords live in the locked
-- `auth` schema) — but far more personal data than the app ever needs to show.
--
-- AFTER: a user can read only their OWN full row. Everyone else is read through
-- public_profiles (step A), which carries only safe columns.
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

alter table public.profiles enable row level security;

-- Replace ALL existing policies on profiles with a clean least-privilege set.
-- The old world-read policy has an unknown name, and any lingering permissive
-- policy would silently defeat the lockdown (RLS policies OR together), so we
-- clear them and recreate the whole set deterministically. service_role bypasses
-- RLS entirely, so signup triggers / admin tooling are unaffected.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;

-- Read ONLY your own row (others come from public_profiles).
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);

-- Create / update ONLY your own row (app inserts own profile on first join and
-- updates own in onboarding / settings / streak / shooting).
create policy "profiles self insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
