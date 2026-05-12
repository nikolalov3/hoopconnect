-- ============================================================================
-- HoopConnect — Bundle "Zamknij pętlę" + revoke notifications fix
-- Run in Supabase SQL Editor (idempotent — wszystko CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.revoke_team_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_invite RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_invite FROM public.team_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF NOT public.is_team_coach(v_invite.team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;
  UPDATE public.team_invites
     SET status = 'revoked', responded_at = NOW()
   WHERE id = p_invite_id;
  UPDATE public.notifications
     SET read = TRUE
   WHERE type = 'team_invite'
     AND payload->>'invite_id' = p_invite_id::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_team_invite(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.decline_team_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite      RECORD;
  v_user_email  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO v_invite
    FROM public.team_invites
   WHERE id = p_invite_id AND lower(invited_email) = v_user_email
   FOR UPDATE;
  IF FOUND AND v_invite.status = 'pending' THEN
    UPDATE public.team_invites
       SET status = 'declined', responded_at = NOW()
     WHERE id = p_invite_id;
  END IF;
  UPDATE public.notifications SET read = TRUE
   WHERE user_id = auth.uid() AND type = 'team_invite'
     AND payload->>'invite_id' = p_invite_id::TEXT;
  RETURN jsonb_build_object('status', 'declined');
END;
$$;
REVOKE ALL ON FUNCTION public.decline_team_invite(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.decline_team_invite(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite      RECORD;
  v_user_email  TEXT;
  v_team_name   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN RAISE EXCEPTION 'no email on user'; END IF;

  SELECT * INTO v_invite
    FROM public.team_invites
   WHERE id = p_invite_id AND lower(invited_email) = v_user_email
   FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.notifications SET read = TRUE
     WHERE user_id = auth.uid() AND type = 'team_invite'
       AND payload->>'invite_id' = p_invite_id::TEXT;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT name INTO v_team_name FROM public.teams WHERE id = v_invite.team_id;

  IF v_invite.status IN ('revoked', 'declined', 'expired') THEN
    UPDATE public.notifications SET read = TRUE
     WHERE user_id = auth.uid() AND type = 'team_invite'
       AND payload->>'invite_id' = p_invite_id::TEXT;
    RETURN jsonb_build_object('status', v_invite.status, 'team_name', v_team_name);
  END IF;

  IF v_invite.status = 'accepted' THEN
    INSERT INTO public.team_members (team_id, player_id, display_first_name, display_last_name)
    VALUES (v_invite.team_id, auth.uid(), v_invite.invited_first_name, v_invite.invited_last_name)
    ON CONFLICT (team_id, player_id) DO NOTHING;
    UPDATE public.notifications SET read = TRUE
     WHERE user_id = auth.uid() AND type = 'team_invite'
       AND payload->>'invite_id' = p_invite_id::TEXT;
    RETURN jsonb_build_object('status', 'accepted', 'team_name', v_team_name, 'already', TRUE);
  END IF;

  INSERT INTO public.team_members (team_id, player_id, display_first_name, display_last_name)
  VALUES (v_invite.team_id, auth.uid(), v_invite.invited_first_name, v_invite.invited_last_name)
  ON CONFLICT (team_id, player_id) DO NOTHING;

  UPDATE public.team_invites
     SET status = 'accepted', responded_at = NOW(), invited_player_id = auth.uid()
   WHERE id = p_invite_id;

  UPDATE public.notifications SET read = TRUE
   WHERE user_id = auth.uid() AND type = 'team_invite'
     AND payload->>'invite_id' = p_invite_id::TEXT;

  RETURN jsonb_build_object('status', 'accepted', 'team_name', v_team_name, 'already', FALSE);
END;
$$;


CREATE OR REPLACE FUNCTION public.invite_player(
  p_team_id    UUID,
  p_email      TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name  TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT; v_player_id UUID; v_invite_id UUID;
  v_team_name TEXT; v_team_org TEXT;
  v_first TEXT; v_last TEXT; v_label TEXT;
  v_status TEXT; v_coach_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_team_coach(p_team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;

  v_email := lower(trim(p_email));
  v_first := NULLIF(trim(coalesce(p_first_name, '')), '');
  v_last  := NULLIF(trim(coalesce(p_last_name,  '')), '');
  v_label := NULLIF(trim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), '');

  SELECT id INTO v_player_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  SELECT name, organization INTO v_team_name, v_team_org FROM teams WHERE id = p_team_id;
  SELECT full_name INTO v_coach_name FROM coach_profiles WHERE id = auth.uid();

  IF v_player_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND player_id = v_player_id)
  THEN
    RETURN jsonb_build_object('status','already_member','player_resolved',TRUE,'team_name',v_team_name);
  END IF;

  SELECT id INTO v_invite_id FROM team_invites
   WHERE team_id = p_team_id AND lower(invited_email) = v_email AND status = 'pending'
   FOR UPDATE;

  IF v_invite_id IS NOT NULL THEN
    UPDATE team_invites
       SET invited_first_name = v_first, invited_last_name = v_last,
           invited_player_id = v_player_id, invited_by = auth.uid(), created_at = NOW()
     WHERE id = v_invite_id;
    v_status := 'invite_resent';
  ELSE
    BEGIN
      INSERT INTO team_invites (team_id, invited_email, invited_first_name, invited_last_name,
                                invited_player_id, invited_by, status)
      VALUES (p_team_id, v_email, v_first, v_last, v_player_id, auth.uid(), 'pending')
      RETURNING id INTO v_invite_id;
      v_status := 'invite_created';
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_invite_id FROM team_invites
       WHERE team_id = p_team_id AND lower(invited_email) = v_email AND status = 'pending';
      UPDATE team_invites
         SET invited_first_name = v_first, invited_last_name = v_last,
             invited_player_id = v_player_id, invited_by = auth.uid(), created_at = NOW()
       WHERE id = v_invite_id;
      v_status := 'invite_resent';
    END;
  END IF;

  IF v_player_id IS NOT NULL THEN
    UPDATE notifications SET read = TRUE
     WHERE user_id = v_player_id AND type = 'team_invite'
       AND payload->>'invite_id' = v_invite_id::TEXT;

    INSERT INTO notifications (user_id, type, payload, action_url) VALUES (
      v_player_id, 'team_invite',
      jsonb_build_object(
        'invite_id',    v_invite_id,
        'team_id',      p_team_id,
        'team_name',    v_team_name,
        'organization', v_team_org,
        'coach_label',  v_label,
        'coach_name',   v_coach_name
      ),
      '/invites/' || v_invite_id::TEXT
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_status, 'invite_id', v_invite_id,
    'player_resolved', v_player_id IS NOT NULL, 'team_name', v_team_name
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.update_team_member(
  p_team_id UUID, p_player_id UUID,
  p_first_name TEXT DEFAULT NULL, p_last_name TEXT DEFAULT NULL,
  p_jersey_number INT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_team_coach(p_team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;
  UPDATE public.team_members
     SET display_first_name = NULLIF(trim(coalesce(p_first_name, '')), ''),
         display_last_name  = NULLIF(trim(coalesce(p_last_name, '')), ''),
         jersey_number      = p_jersey_number
   WHERE team_id = p_team_id AND player_id = p_player_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_team_member(UUID,UUID,TEXT,TEXT,INT) FROM public;
GRANT EXECUTE ON FUNCTION public.update_team_member(UUID,UUID,TEXT,TEXT,INT) TO authenticated;


CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id UUID, p_player_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_team_name TEXT;
BEGIN
  IF NOT public.is_team_coach(p_team_id) THEN
    RAISE EXCEPTION 'not authorized for this team';
  END IF;
  SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
  DELETE FROM public.team_members
   WHERE team_id = p_team_id AND player_id = p_player_id;
  INSERT INTO public.notifications (user_id, type, payload) VALUES (
    p_player_id, 'team_removed',
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team_name)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.remove_team_member(UUID,UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID,UUID) TO authenticated;
