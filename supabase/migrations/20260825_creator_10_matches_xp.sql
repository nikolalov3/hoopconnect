-- ============================================================================
-- Milestone reward: create 10 matches → +240 XP (one-time, per player).
--
-- Consistent with the existing XP system (20260607_xp_arena_system.sql): XP is
-- granted ONLY server-side via add_player_xp() (which is revoked from clients),
-- so a player can never self-grant this. A trigger on club_matches counts the
-- creator's matches and, the first time they reach 10, awards 240 XP exactly once.
--
-- Once-only is enforced by a small ledger table (creator_xp_milestones), so the
-- reward can't be farmed by deleting + re-creating matches around the threshold.
--
-- Repo is PUBLIC — no secrets/PII here.
-- ============================================================================

-- 1) Ledger of granted creator milestones (one row per user per threshold) ────
create table if not exists public.creator_xp_milestones (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  threshold  integer not null,               -- e.g. 10 (matches created)
  granted_at timestamptz not null default now(),
  primary key (user_id, threshold)
);
alter table public.creator_xp_milestones enable row level security;
-- Readable by the owner (for a future "you earned this" UI); NO client INSERT
-- policy — only the SECURITY DEFINER trigger below writes rows.
drop policy if exists "own creator milestones readable" on public.creator_xp_milestones;
create policy "own creator milestones readable"
  on public.creator_xp_milestones for select using (auth.uid() = user_id);

-- 2) Trigger — on a new match, if the creator has now created >= 10 matches and
--    has not been rewarded yet, grant +240 XP exactly once. ────────────────────
create or replace function public.trg_award_creator_10_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_ins   integer;
begin
  if NEW.created_by is null then
    return NEW;
  end if;

  select count(*) into v_count
    from public.club_matches
   where created_by = NEW.created_by;

  if v_count >= 10 then
    -- record the milestone; only grant XP if THIS insert actually happened
    -- (on conflict = already rewarded → v_ins stays null → no double grant).
    insert into public.creator_xp_milestones (user_id, threshold)
      values (NEW.created_by, 10)
      on conflict do nothing
      returning 1 into v_ins;

    if v_ins is not null then
      perform public.add_player_xp(NEW.created_by, 240);
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists award_creator_10_matches on public.club_matches;
create trigger award_creator_10_matches
  after insert on public.club_matches
  for each row
  execute function public.trg_award_creator_10_matches();

-- 3) Backfill (RETROACTIVE) — players who ALREADY created >= 10 matches get the
--    240 XP now, once. Delete this block if you want the reward to apply only to
--    milestones reached from here on (existing heavy creators would then get it
--    on their NEXT created match instead).
do $$
declare
  r record;
  v_ins integer;
begin
  for r in
    select created_by as uid
      from public.club_matches
     where created_by is not null
     group by created_by
    having count(*) >= 10
  loop
    insert into public.creator_xp_milestones (user_id, threshold)
      values (r.uid, 10)
      on conflict do nothing
      returning 1 into v_ins;
    if v_ins is not null then
      perform public.add_player_xp(r.uid, 240);
    end if;
  end loop;
end;
$$;
