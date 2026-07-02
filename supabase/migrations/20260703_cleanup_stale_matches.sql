-- ============================================================================
-- Sprzątanie meczów, do których nikt nie dołączył.
-- Mecz bez przeciwnika (away_club_id IS NULL), godzinę po planowanym terminie,
-- jest usuwany z bazy (match_players znika kaskadowo). Wołane lazy z frontu
-- przy ładowaniu listy meczów.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.club_matches
  WHERE away_club_id IS NULL
    AND status NOT IN ('completed', 'cancelled')
    AND scheduled_at < now() - interval '1 hour';
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO authenticated;
