-- ============================================================================
-- Card customization system: catalog of items (card backgrounds + frames),
-- per-user unlocks, an equipped background on the profile, and redeem codes.
--
-- Design:
--   card_items         — the catalog. Add a row = new item in the app, no deploy.
--   user_unlocks       — which items a user OWNS (from a code / purchase / grant).
--   profiles.equipped_background — the equipped one (mirrors equipped_frame).
--   redeem_codes       — code -> item, with use limit / expiry.
--   code_redemptions   — one redemption per user per code.
--   redeem_code(code)  — SECURITY DEFINER RPC that validates + grants atomically.
--
-- Repo is PUBLIC — no secrets here. Codes live in the DB, are NOT client-readable
-- (no SELECT policy), and are only ever consumed through the RPC.
-- ============================================================================

-- 1. Catalog ────────────────────────────────────────────────────────────────
create table if not exists public.card_items (
  id          text primary key,                 -- 'bg_dragon', 'frame_diamond_s1', ...
  type        text not null check (type in ('background','frame')),
  name        text not null,
  asset_path  text not null,                    -- '/backgrounds/dragon.png'
  rarity      text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  price_cents integer,                          -- null = not purchasable
  is_default  boolean not null default false,   -- everyone owns it (free)
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.card_items enable row level security;
drop policy if exists "card_items readable" on public.card_items;
create policy "card_items readable" on public.card_items for select using (active);

-- 2. Per-user unlocks ────────────────────────────────────────────────────────
create table if not exists public.user_unlocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null references public.card_items(id) on delete cascade,
  source     text not null default 'grant' check (source in ('code','purchase','grant','achievement','default')),
  granted_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_unlocks enable row level security;
drop policy if exists "own unlocks readable" on public.user_unlocks;
create policy "own unlocks readable" on public.user_unlocks for select using (auth.uid() = user_id);

-- 3. Equipped background on the profile (equipped_frame already exists) ───────
alter table public.profiles
  add column if not exists equipped_background text references public.card_items(id) on delete set null;

-- 4. Redeem codes ────────────────────────────────────────────────────────────
create table if not exists public.redeem_codes (
  code       text primary key,                  -- stored/compared UPPER-cased
  item_id    text not null references public.card_items(id) on delete cascade,
  max_uses   integer,                           -- null = unlimited
  used_count integer not null default 0,
  expires_at timestamptz,
  active     boolean not null default true
);
alter table public.redeem_codes enable row level security;
-- NO select policy on purpose → codes are never readable by clients.

create table if not exists public.code_redemptions (
  code        text not null references public.redeem_codes(code) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.code_redemptions enable row level security;
drop policy if exists "own redemptions readable" on public.code_redemptions;
create policy "own redemptions readable" on public.code_redemptions for select using (auth.uid() = user_id);

-- 5. Redeem RPC — validate + grant atomically ────────────────────────────────
create or replace function public.redeem_code(p_code text)
returns table (item_id text, item_type text, item_name text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_item text; v_max int; v_used int; v_exp timestamptz; v_active boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select rc.item_id, rc.max_uses, rc.used_count, rc.expires_at, rc.active
    into v_item, v_max, v_used, v_exp, v_active
    from public.redeem_codes rc where rc.code = v_code for update;

  if not found or not v_active                              then raise exception 'invalid_code'; end if;
  if v_exp is not null and v_exp < now()                    then raise exception 'expired_code'; end if;
  if v_max is not null and v_used >= v_max                  then raise exception 'code_exhausted'; end if;
  if exists (select 1 from public.code_redemptions
             where code = v_code and user_id = v_uid)       then raise exception 'already_redeemed'; end if;

  insert into public.code_redemptions(code, user_id) values (v_code, v_uid);
  update public.redeem_codes set used_count = used_count + 1 where code = v_code;
  insert into public.user_unlocks(user_id, item_id, source)
    values (v_uid, v_item, 'code') on conflict do nothing;

  return query select ci.id, ci.type, ci.name from public.card_items ci where ci.id = v_item;
end $$;
revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;

-- 6. Seed (examples — swap asset_path for real files in public/backgrounds/) ──
insert into public.card_items (id, type, name, asset_path, rarity, is_default, sort) values
  ('bg_nebula', 'background', 'Mgławica',    '/backgrounds/nebula.png', 'common',    true,  10),
  ('bg_dragon', 'background', 'Różowy Smok', '/backgrounds/dragon.png', 'legendary', false, 20)
on conflict (id) do nothing;

-- Example code that grants the dragon background (100 uses):
insert into public.redeem_codes (code, item_id, max_uses) values
  ('SMOK2026', 'bg_dragon', 100)
on conflict (code) do nothing;
