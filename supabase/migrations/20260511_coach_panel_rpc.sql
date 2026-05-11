-- ============================================================================
-- HoopConnect — Coach panel RPC: accept_team_invite
-- Run in Supabase SQL Editor AFTER 20260511_coach_panel.sql
--
-- Player-side accept flow needs to write to 3 tables atomically:
--   - team_members  (INSERT)
--   - team_invites  (UPDATE status)
--   - notifications (UPDATE read)
--
-- The RLS policies we defined deliberately don't let players INSERT into
-- team_members (only coaches do that). So we wrap the accept flow in a
-- SECURITY DEFINER function that authoritatively performs the writes after
-- verifying that the caller's email matches the invite's invited_email.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite      RECORD;
  v_user_email  TEXT;
  v_team_name   TEXT;
BEGIN
  -- Caller must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Look up the caller's email
  SELECT lower(email) INTO v_user_email
    FROM auth.users WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'no email on user';
  END IF;

  -- Lock the invite and verify it's still claimable by this email
  SELECT * INTO v_invite
    FROM public.team_invites
   WHERE id = p_invite_id
     AND status = 'pending'
     AND lower(invited_email) = v_user_email
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or no longer pending';
  END IF;

  -- Insert membership (idempotent — re-running accept is a no-op)
  INSERT INTO public.team_members (
    team_id, player_id, display_first_name, display_last_name
  ) VALUES (
    v_invite.team_id, auth.uid(),
    v_invite.invited_first_name, v_invite.invited_last_name
  )
  ON CONFLICT (team_id, player_id) DO NOTHING;

  -- Mark invite accepted
  UPDATE public.team_invites
     SET status            = 'accepted',
         responded_at      = NOW(),
         invited_player_id = auth.uid()
   WHERE id = p_invite_id;

  -- Mark every notification referring to this invite as read
  UPDATE public.notifications
     SET read = TRUE
   WHERE user_id = auth.uid()
     AND type = 'team_invite'
     AND payload->>'invite_id' = p_invite_id::TEXT;

  -- Return team info for client-side toast
  SELECT name INTO v_team_name FROM public.teams WHERE id = v_invite.team_id;

  RETURN jsonb_build_object(
    'team_id',   v_invite.team_id,
    'team_name', v_team_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(UUID) TO authenticated;
