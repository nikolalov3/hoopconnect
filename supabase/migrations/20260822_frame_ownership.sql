-- ============================================================================
-- Durable, DB-backed frame ownership.
--
-- Until now a frame's ownership lived only in localStorage (frameSeenKey), so a
-- legendary like diamond_s1 vanished from the picker on a second device / cleared
-- storage the moment you switched to another frame. This makes ownership durable
-- via the existing public.user_unlocks table (from 20260814_card_customization).
--
--   card_items rows        — the frames added to the shared item catalog.
--   frame_early_access     — is_default = true → everyone owns it (no unlock row).
--   frame_diamond_s1       — earned; granted by the claim_diamond_s1() RPC below.
--   frame_ff               — Friends & Family; granted manually (see bottom).
--
-- The app maps a catalog frame id (equipped_frame value, e.g. 'diamond_s1') to a
-- card_items id ('frame_diamond_s1') via FRAME_CATALOG[].itemId in src/lib/frames.js.
-- The picker reads user_unlocks (RLS: own rows readable) to decide what's unlocked.
--
-- Repo is PUBLIC — no secrets/PII here.
-- ============================================================================

-- 1. Catalog rows for the frames ─────────────────────────────────────────────
insert into public.card_items (id, type, name, asset_path, rarity, is_default, sort) values
  ('frame_early_access', 'frame', 'Early Access',       '/earlyaccess.png', 'rare',      true,  100),
  ('frame_diamond_s1',   'frame', 'Diament — Sezon 1',  '/ramkas1diax.png', 'legendary', false, 110),
  ('frame_ff',           'frame', 'Friends & Family',   '/ff.png',          'legendary', false, 120)
on conflict (id) do nothing;

-- 2. Earn-based grant for diamond_s1 — server-authoritative ───────────────────
-- user_unlocks has NO client INSERT policy (only the redeem_code RPC writes it),
-- so a plain policy would let anyone self-grant any paid item. This RPC re-checks
-- the earn rule (weekly_points >= 820, Season 1 over) server-side, then grants.
-- Idempotent: on conflict do nothing. Returns true if the user qualifies (whether
-- it granted now or they already owned it), false otherwise.
create or replace function public.claim_diamond_s1()
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_wp  integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if now() < timestamptz '2026-08-24 00:00:00' then return false; end if;  -- SEASON_1_END

  select weekly_points into v_wp from public.profiles where id = v_uid;
  if coalesce(v_wp, 0) < 820 then return false; end if;                    -- DIAMOND_MIN

  insert into public.user_unlocks (user_id, item_id, source)
    values (v_uid, 'frame_diamond_s1', 'achievement')
    on conflict do nothing;
  return true;
end $$;
revoke all on function public.claim_diamond_s1() from public;
grant execute on function public.claim_diamond_s1() to authenticated;

-- 3. Backfill ownership for anyone already granted ff (equipped_frame='ff') ────
insert into public.user_unlocks (user_id, item_id, source)
select id, 'frame_ff', 'grant' from public.profiles where equipped_frame = 'ff'
on conflict do nothing;

-- ── Granting Friends & Family to a new person later (run per account): ────────
-- insert into public.user_unlocks (user_id, item_id, source)
--   select id, 'frame_ff', 'grant' from public.profiles where username = 'THEIR_EMAIL'
--   on conflict do nothing;
-- (Optionally also set profiles.equipped_frame='ff' to equip it for them.)
