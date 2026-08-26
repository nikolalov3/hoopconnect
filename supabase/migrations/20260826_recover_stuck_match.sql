-- ============================================================================
-- One-off recovery for the stuck match af497c42 (3v3, played today).
--
-- State in DB: status='result_pending', away_club_id=NULL, score_home=0,
-- score_away=11. The away captain's confirmation and the away-club claim were
-- both silently RLS-rejected (0 rows, no error) — root cause fixed in the client
-- going forward. This script recovers THIS match: derive the away club from the
-- away players, then flip result_pending -> completed so the live match-XP trigger
-- (trg_award_match_xp) grants XP (35 win / 15 loss) + points_log (50 / 20) to every
-- participant. points_log has a unique index on (user_id, match_id, source) so a
-- re-run is idempotent.
--
-- ⚠️ VERIFY THE SCORE FIRST. score_home=0, score_away=11 means the HOME club
-- (LOVE C., the creator) LOST 0:11 and the AWAY club won. If that is BACKWARDS
-- (LOVE C. actually won 11:0), uncomment the score-swap line below BEFORE the
-- completion runs, otherwise XP will be granted for the wrong side.
-- ============================================================================

-- ── STEP 0 (run alone first to eyeball it): who played + the derived away club ──
-- select mp.team, mp.slot, p.name, cm.club_id
--   from public.match_players mp
--   left join public.profiles p on p.id = mp.user_id
--   left join public.club_members cm on cm.user_id = mp.user_id
--  where mp.match_id = 'af497c42-a5af-44cf-8166-acb044704277'
--  order by mp.team, mp.slot;

do $$
declare
  v_match     uuid := 'af497c42-a5af-44cf-8166-acb044704277';
  v_away_club uuid;
begin
  -- (optional) fix a backwards score BEFORE completing — uncomment if needed:
  -- update public.club_matches set score_home = 11, score_away = 0 where id = v_match;

  -- derive the single away club from the away-team players' membership
  select cm.club_id into v_away_club
    from public.match_players mp
    join public.club_members cm on cm.user_id = mp.user_id
   where mp.match_id = v_match and mp.team = 'away'
   group by cm.club_id
   order by count(*) desc
   limit 1;

  if v_away_club is null then
    raise notice 'No away club found (away players have no club membership). away_club_id stays NULL and the XP trigger will NOT fire. Investigate before completing.';
  else
    update public.club_matches set away_club_id = v_away_club
     where id = v_match and away_club_id is null;
    raise notice 'away_club_id set to %', v_away_club;

    -- complete → trigger grants XP + points to all participants
    update public.club_matches set status = 'completed'
     where id = v_match and status = 'result_pending';
    raise notice 'match completed — XP/points granted by trg_award_match_xp';
  end if;
end $$;
