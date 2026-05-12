-- ============================================================================
-- HoopConnect — delete_coach_broadcast
-- Pełne usunięcie broadcastu z historii (oraz związanych notyfikacji, jeśli
-- jeszcze były nieprzeczytane). Działa zarówno na cofnięte jak i aktywne.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_coach_broadcast(p_broadcast_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_team_id UUID;
BEGIN
  SELECT team_id INTO v_team_id FROM public.coach_broadcasts WHERE id = p_broadcast_id;
  IF NOT FOUND THEN RETURN; END IF;  -- idempotent
  IF NOT public.is_team_coach(v_team_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  DELETE FROM public.notifications
   WHERE type = 'coach_message'
     AND payload->>'broadcast_id' = p_broadcast_id::TEXT;
  DELETE FROM public.coach_broadcasts WHERE id = p_broadcast_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_coach_broadcast(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_coach_broadcast(UUID) TO authenticated;
