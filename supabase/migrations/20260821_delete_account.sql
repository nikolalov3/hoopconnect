-- ────────────────────────────────────────────────────────────────────────────
-- In-app account deletion (Apple Guideline 5.1.1(v) + Google Play policy).
-- The client calls supabase.rpc('delete_account'); the function is SECURITY
-- DEFINER so it can remove the auth.users row (the client only has the anon key).
--
-- NOTE: `profiles` and some player-data tables (points_log, etc.) are NOT in the
-- tracked migrations, so we can't see every foreign key from source. Run the
-- DIAGNOSTIC below first — it lists every FK to the user that would BLOCK deletion
-- (delete_rule = NO ACTION / RESTRICT). If it returns any table beyond the four
-- already handled, add a matching `delete from public.<table> where <col> = uid;`
-- line to the function before the `delete from public.profiles` line.
-- ────────────────────────────────────────────────────────────────────────────

-- ── DIAGNOSTIC (run once, read-only) ─────────────────────────────────────────
-- select tc.table_schema, tc.table_name, kcu.column_name, rc.delete_rule
-- from information_schema.referential_constraints rc
-- join information_schema.table_constraints  tc  on tc.constraint_name  = rc.constraint_name  and tc.constraint_schema  = rc.constraint_schema
-- join information_schema.key_column_usage   kcu on kcu.constraint_name = rc.constraint_name  and kcu.constraint_schema = rc.constraint_schema
-- join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.constraint_name and ccu.constraint_schema = rc.constraint_schema
-- where ccu.table_name in ('users','profiles')
--   and rc.delete_rule not in ('CASCADE','SET NULL')
-- order by tc.table_name, kcu.column_name;

-- ── RPC ──────────────────────────────────────────────────────────────────────
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Clear rows whose FK to the user has NO on-delete rule (they would otherwise
  -- block deleting the profile). These four are the RESTRICT FKs in the schema.
  delete from public.match_players  where user_id          = uid;
  delete from public.club_matches   where created_by       = uid;
  delete from public.team_invites   where invited_player_id = uid;
  delete from public.kotc_mvp_votes where voted_player_id  = uid;
  -- << add any extra tables the DIAGNOSTIC surfaces here >>

  -- Remove the profile → cascades every table with `references profiles on delete cascade`.
  delete from public.profiles where id = uid;

  -- Remove the auth identity → cascades tables that FK auth.users directly
  -- (user_unlocks, code_redemptions, name_reports, coach_profiles, ...).
  delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_account() from public, anon;
grant  execute on function public.delete_account() to authenticated;
