-- ============================================================================
-- P0 security fix: close the notification-spoofing hole on public.notifications.
--
-- The INSERT policy "coach creates notif for players" (20260511_coach_panel_rls_fix.sql)
-- had an unconditional `type = 'team_invite' OR ...` branch. Because both players and
-- coaches hold the `authenticated` role, ANY logged-in user could directly INSERT a
-- notification with type='team_invite', an arbitrary target user_id, attacker-controlled
-- payload (fake team/coach name) and action_url — i.e. in-app phishing ("Coach X invited
-- you" linking anywhere in the app).
--
-- No legitimate client ever inserts into notifications directly: the real invite and
-- broadcast paths INSERT from inside SECURITY DEFINER RPCs (invite_player,
-- send_coach_broadcast), which bypass RLS. So we DROP the direct-INSERT policy entirely.
-- After this, RLS default-denies all client-side inserts to notifications; the definer
-- RPCs keep working unchanged. SELECT (own) and UPDATE (mark own read) policies stay.
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

drop policy if exists "coach creates notif for players" on public.notifications;
