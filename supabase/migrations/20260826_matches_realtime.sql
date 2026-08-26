-- ============================================================================
-- Live match updates on the Mecze screen.
--
-- MatchesPanel already subscribes to postgres_changes on public.match_players
-- (ClubPage.jsx) to update the roster live as people join/leave — but the table
-- was NEVER added to the supabase_realtime publication, so no events were ever
-- emitted and joins only showed after a manual refresh. This adds match_players
-- (and club_matches, for live status/score) to the publication.
--
-- REPLICA IDENTITY FULL so DELETE (leave) events carry the old row's match_id
-- (the handler reads payload.old?.match_id on leave). Idempotent.
-- ============================================================================

alter table public.match_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_players'
  ) then
    alter publication supabase_realtime add table public.match_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_matches'
  ) then
    alter publication supabase_realtime add table public.club_matches;
  end if;
end $$;
