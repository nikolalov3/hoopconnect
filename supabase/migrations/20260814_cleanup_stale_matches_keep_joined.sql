-- ============================================================================
-- FIX: cleanup_stale_matches usuwał też mecze, w których PRZECIWNICY DOŁĄCZYLI
-- jako gracze, ale bez osobnego klubu-rywala (pickup / mecz towarzyski). Taki
-- mecz ma away_club_id IS NULL, więc łapał się w DELETE i znikał z bazy razem
-- z match_players — choć ludzie faktycznie zagrali i czekali na potwierdzenie
-- wyniku. (W połączeniu z blokadą wyniku status utykał na 'full' → kasowany.)
--
-- Teraz kasujemy tylko mecze, do których NIKT nie dołączył po stronie away
-- (brak jakiegokolwiek match_players z team='away'). Mecze rozegrane zostają.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.club_matches cm
  WHERE cm.away_club_id IS NULL
    AND cm.status NOT IN ('completed', 'cancelled')
    AND cm.scheduled_at < now() - interval '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = cm.id
        AND mp.team = 'away'
    );
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO authenticated;
