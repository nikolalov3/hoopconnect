-- ============================================================================
-- 1) Notify the away captain when a result needs confirming.
--
-- BUG: when the home captain submitted a score (status -> 'result_pending'), the
-- away captain was NEVER notified. The only way they'd see the "confirm score"
-- sheet was to happen to open the matches tab (checkPendingResult) — no in-app
-- notification existed for this at all (the app only knew team_invite /
-- coach_message / team_removed). So confirmations silently stalled.
--
-- FIX: an AFTER UPDATE trigger on club_matches. On the transition INTO
-- 'result_pending' it inserts a `match_result_confirm` notification for the away
-- captain — defined exactly as the app does (away player in the lowest slot =
-- `awayLeadId` in checkPendingResult), so the same person who gets the
-- notification is the one the confirm sheet opens for. SECURITY DEFINER: runs
-- as the owner, so it works with notifications' write-locked RLS (no client
-- INSERT policy — that hole was closed on purpose).
--
-- 2) One-off recovery of the stuck 2v2 e894ce64 (played 2026-09-06): Love club
-- (home) LOST 2:11 — the score was entered backwards (home 11 / away 2). Fix the
-- direction and complete it in ONE statement so trg_award_match_xp sees the
-- corrected score and grants win/loss XP + points correctly. Idempotent (acts
-- only while result_pending).
--
-- Run in the Supabase SQL editor. Repo is PUBLIC — no secrets here.
-- ============================================================================

-- ─── 1) trigger: notify away captain on result_pending ──────────────────────
create or replace function public.trg_notify_away_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_away_lead uuid;
  v_home_name text;
  v_away_name text;
begin
  -- Only on the transition INTO result_pending (home captain just submitted).
  if NEW.status = 'result_pending' and (OLD.status is distinct from 'result_pending') then
    -- Away captain = the away CLUB'S OWNER if they're on the away roster (a captain
    -- who joined second must still be the one to confirm); otherwise fall back to
    -- the away player in the lowest slot. Mirrors the app's awayLeadId exactly.
    select mp.user_id into v_away_lead
      from public.match_players mp
      join public.clubs c on c.id = NEW.away_club_id
     where mp.match_id = NEW.id and mp.team = 'away' and mp.user_id = c.owner_id
     limit 1;
    if v_away_lead is null then
      select user_id into v_away_lead
        from public.match_players
       where match_id = NEW.id and team = 'away'
       order by slot asc
       limit 1;
    end if;

    if v_away_lead is not null then
      select name into v_home_name from public.clubs where id = NEW.club_id;
      select name into v_away_name from public.clubs where id = NEW.away_club_id;

      insert into public.notifications (user_id, type, payload, action_url)
      values (
        v_away_lead,
        'match_result_confirm',
        jsonb_build_object(
          'match_id',     NEW.id,
          'home_name',    coalesce(v_home_name, 'Rywale'),
          'away_name',    coalesce(v_away_name, 'Rywale'),
          'score_home',   NEW.score_home,
          'score_away',   NEW.score_away,
          'submitted_at', NEW.result_submitted_at
        ),
        '/club'
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists notify_away_result on public.club_matches;
create trigger notify_away_result
  after update on public.club_matches
  for each row
  execute function public.trg_notify_away_result();

-- ─── 2) one-off recovery: stuck 2v2 e894ce64 — Love club (home) lost 2:11 ───
-- Score + status in ONE update so the XP trigger reads the corrected score.
update public.club_matches
   set score_home = 2,
       score_away = 11,
       status     = 'completed'
 where id = 'e894ce64-a7d7-4963-a5ef-b62d94081fc7'
   and status = 'result_pending';
