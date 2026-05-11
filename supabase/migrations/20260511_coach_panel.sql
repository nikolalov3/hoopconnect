-- ============================================================================
-- HoopConnect — Coach Panel schema
-- Adds tables for coach accounts, teams, team members, invites, notifications.
-- Run this once in Supabase SQL Editor.
-- ============================================================================

-- ─── 1. COACH PROFILES ──────────────────────────────────────────────────────
-- Separate from player `profiles`. Same auth.users can theoretically have both
-- rows (very rare case), but normally a user is one or the other.
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  city        TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 2. TEAMS ───────────────────────────────────────────────────────────────
-- One coach can own many teams (U16 + U14 + senior, etc.).
CREATE TABLE IF NOT EXISTS public.teams (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  organization   TEXT,
  age_category   TEXT NOT NULL,   -- 'U10','U12','U14','U16','U18','Senior'
  section        TEXT NOT NULL,   -- 'M','K','Mixed'
  level          TEXT,            -- 'amator','wojewodzki','centralny','i_liga','ekstraklasa'
  city           TEXT,
  logo_url       TEXT,
  primary_color  TEXT DEFAULT '#5591CD',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  archived_at    TIMESTAMPTZ      -- soft delete: NULL = active
);

CREATE INDEX IF NOT EXISTS idx_teams_coach_active
  ON public.teams(coach_id) WHERE archived_at IS NULL;


-- ─── 3. TEAM MEMBERS ────────────────────────────────────────────────────────
-- Confirmed players in a team. Coach types display_first_name + display_last_name
-- manually — they persist as the coach's label for that player regardless of
-- what the player has set as their app username.
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id              UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_first_name   TEXT NOT NULL,
  display_last_name    TEXT NOT NULL,
  jersey_number        INT,
  joined_at            TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_player ON public.team_members(player_id);


-- ─── 4. TEAM INVITES ────────────────────────────────────────────────────────
-- Pending invitation. Coach pre-fills email + first + last name. We try to
-- resolve invited_player_id when an email matches an existing player profile;
-- otherwise it stays NULL and the player completes registration with that email.
CREATE TABLE IF NOT EXISTS public.team_invites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email       TEXT NOT NULL,
  invited_first_name  TEXT NOT NULL,
  invited_last_name   TEXT NOT NULL,
  invited_player_id   UUID REFERENCES public.profiles(id),
  invited_by          UUID NOT NULL REFERENCES public.coach_profiles(id),
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','declined','expired','revoked')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  responded_at        TIMESTAMPTZ
);

-- Prevent a coach from spamming duplicate pending invites for the same email
CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_invite_pending
  ON public.team_invites(team_id, lower(invited_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_invites_email_pending
  ON public.team_invites(lower(invited_email)) WHERE status = 'pending';


-- ─── 5. NOTIFICATIONS ───────────────────────────────────────────────────────
-- In-app notifications shown as the red dot on player avatar / sheet list.
-- Drives team invites, coach messages, and (future) team practice reminders.
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- 'team_invite','coach_message','team_practice'
  payload     JSONB NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE read = FALSE;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.coach_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;


-- ─── coach_profiles: own row only ──────────────────────────────────────────
DROP POLICY IF EXISTS "coach reads own profile" ON public.coach_profiles;
CREATE POLICY "coach reads own profile"
  ON public.coach_profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "coach inserts own profile" ON public.coach_profiles;
CREATE POLICY "coach inserts own profile"
  ON public.coach_profiles FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "coach updates own profile" ON public.coach_profiles;
CREATE POLICY "coach updates own profile"
  ON public.coach_profiles FOR UPDATE USING (id = auth.uid());


-- ─── teams: coach owns; team members can SELECT their team ─────────────────
DROP POLICY IF EXISTS "coach owns teams" ON public.teams;
CREATE POLICY "coach owns teams"
  ON public.teams FOR ALL USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "members read team" ON public.teams;
CREATE POLICY "members read team"
  ON public.teams FOR SELECT
  USING (id IN (SELECT team_id FROM public.team_members WHERE player_id = auth.uid()));


-- ─── team_members: coach manages; player reads own membership ──────────────
DROP POLICY IF EXISTS "coach manages team members" ON public.team_members;
CREATE POLICY "coach manages team members"
  ON public.team_members FOR ALL
  USING (team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS "player reads own membership" ON public.team_members;
CREATE POLICY "player reads own membership"
  ON public.team_members FOR SELECT USING (player_id = auth.uid());


-- ─── team_invites: coach manages own; player sees + responds by email ──────
DROP POLICY IF EXISTS "coach manages team invites" ON public.team_invites;
CREATE POLICY "coach manages team invites"
  ON public.team_invites FOR ALL
  USING (team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS "player reads own invites" ON public.team_invites;
CREATE POLICY "player reads own invites"
  ON public.team_invites FOR SELECT
  USING (lower(invited_email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "player updates own invite response" ON public.team_invites;
CREATE POLICY "player updates own invite response"
  ON public.team_invites FOR UPDATE
  USING (lower(invited_email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid()));


-- ─── notifications: user reads/marks own; coach creates for their players ──
DROP POLICY IF EXISTS "user reads own notifications" ON public.notifications;
CREATE POLICY "user reads own notifications"
  ON public.notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user marks own notifications read" ON public.notifications;
CREATE POLICY "user marks own notifications read"
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Coach can insert team_invite notifications for any player matching an email
-- they're inviting; coach_message / team_practice can only target their roster.
DROP POLICY IF EXISTS "coach creates notif for players" ON public.notifications;
CREATE POLICY "coach creates notif for players"
  ON public.notifications FOR INSERT WITH CHECK (
    type = 'team_invite' OR
    user_id IN (
      SELECT tm.player_id FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      WHERE t.coach_id = auth.uid()
    )
  );


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Keep coach_profiles.updated_at fresh
CREATE OR REPLACE FUNCTION public.tg_coach_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_profiles_updated_at ON public.coach_profiles;
CREATE TRIGGER coach_profiles_updated_at
  BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_coach_profiles_updated_at();
