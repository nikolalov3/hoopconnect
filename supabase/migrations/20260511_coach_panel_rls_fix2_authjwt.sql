-- ============================================================================
-- HoopConnect — Coach panel RLS fix 2
-- 'permission denied for table users' when coach inserts team_invite.
--
-- Root cause: the "player reads own invites" / "player updates own invite
-- response" policies did a subquery against auth.users. RLS subqueries run
-- with the calling role's permissions, and the `authenticated` role does not
-- have SELECT privilege on auth.users in Supabase. The error surfaced even
-- on coach INSERT because the .select() RETURNING re-evaluates SELECT
-- policies on the new row.
--
-- Fix: read the caller's email from the JWT instead. auth.jwt() returns the
-- decoded token as JSONB and doesn't touch the auth.users table.
-- Idempotent — safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "player reads own invites" ON public.team_invites;
CREATE POLICY "player reads own invites"
  ON public.team_invites FOR SELECT
  USING (lower(invited_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "player updates own invite response" ON public.team_invites;
CREATE POLICY "player updates own invite response"
  ON public.team_invites FOR UPDATE
  USING (lower(invited_email) = lower(auth.jwt() ->> 'email'));
