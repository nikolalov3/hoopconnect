-- ============================================================================
-- Profiles privacy — STEP A of 2: the minimal public view. RUN THIS FIRST.
--
-- Additive and harmless on its own: it creates a read-only projection of
-- `profiles` exposing ONLY the columns the app renders about OTHER people. It
-- does NOT change what is currently visible (base-table RLS is still whatever it
-- was) — it just makes the safe view exist so the new client code can read from
-- it. Run this, let the new build deploy, THEN run step B (the lockdown).
--
-- A view owned by the postgres role reads past the base-table RLS and returns
-- only these safe columns — the standard "public profile" pattern. It omits age,
-- birth_date/year, city, height, presence timestamps and the raw fraud score.
-- The Supabase advisor may warn about a security-definer view; that is expected
-- and safe here because the projection carries no sensitive columns.
-- Idempotent. Repo is PUBLIC — no secrets here.
-- ============================================================================

drop view if exists public.public_profiles;
create view public.public_profiles as
  select
    id, name, username,
    equipped_frame, equipped_background, background,
    xp, arena_level, kotc_wins,
    country, hc_id,
    (fraud_probability > 0.5) as suspicious
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;
