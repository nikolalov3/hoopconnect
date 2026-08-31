-- ============================================================================
-- Team join codes — lower-friction, self-service way to add players to a coach's
-- team. Each team gets a short non-guessable code; a player joins by typing it in
-- the player app (Settings). Replaces the email-invite-then-accept dance for the
-- common case. The coach can regenerate the code if it leaks.
--
-- Player self-joins (opt-in), so this is privacy-friendlier than the coach typing
-- a minor's data. Coach can still remove members (remove_team_member RPC).
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

-- ── 1. join_code column on teams ────────────────────────────────────────────
alter table public.teams add column if not exists join_code text;

-- Code generator: 6 chars from an unambiguous alphabet (no 0/O/1/I), unique.
create or replace function public.gen_team_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.teams where join_code = code);
  end loop;
  return code;
end;
$$;

-- Backfill existing teams, then make the column self-generating + required.
update public.teams set join_code = public.gen_team_code() where join_code is null;
alter table public.teams alter column join_code set default public.gen_team_code();
create unique index if not exists uniq_teams_join_code on public.teams (join_code);
alter table public.teams alter column join_code set not null;

-- ── 2. join_team_by_code(code) — player joins their own membership ───────────
-- SECURITY DEFINER so a player (who can't read teams via RLS) can look up the
-- team by code and insert their OWN team_members row. display_* are NOT NULL, so
-- we seed them from the player's profile name (coach can edit later).
create or replace function public.join_team_by_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_team_id uuid; v_team_name text;
  v_name text; v_first text; v_last text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_code is null or length(trim(p_code)) = 0 then raise exception 'code required'; end if;

  select id, name into v_team_id, v_team_name
    from public.teams
   where upper(join_code) = upper(trim(p_code)) and archived_at is null
   limit 1;

  if v_team_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (select 1 from public.team_members
              where team_id = v_team_id and player_id = auth.uid()) then
    return jsonb_build_object('status', 'already_member', 'team_name', v_team_name);
  end if;

  select name into v_name from public.profiles where id = auth.uid();
  v_name  := coalesce(nullif(trim(v_name), ''), 'Zawodnik');
  v_first := split_part(v_name, ' ', 1);
  v_last  := btrim(substr(v_name, char_length(v_first) + 1));  -- '' if single word (NOT NULL ok)

  insert into public.team_members (team_id, player_id, display_first_name, display_last_name)
  values (v_team_id, auth.uid(), v_first, v_last)
  on conflict (team_id, player_id) do nothing;

  return jsonb_build_object('status', 'joined', 'team_name', v_team_name);
end;
$$;

revoke all on function public.join_team_by_code(text) from public;
grant execute on function public.join_team_by_code(text) to authenticated;

-- ── 3. regenerate_team_code(team_id) — coach rotates the code ────────────────
create or replace function public.regenerate_team_code(p_team_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_coach(p_team_id) then
    raise exception 'not authorized for this team';
  end if;
  v_code := public.gen_team_code();
  update public.teams set join_code = v_code where id = p_team_id;
  return v_code;
end;
$$;

revoke all on function public.regenerate_team_code(uuid) from public;
grant execute on function public.regenerate_team_code(uuid) to authenticated;
