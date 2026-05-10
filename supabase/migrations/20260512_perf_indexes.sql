-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ PERFORMANCE INDEXES — HoopConnect v1.2.1+                            ║
-- ║ Cel: utrzymać sub-100ms hot-path queries do ~5k MAU.                 ║
-- ║                                                                      ║
-- ║ Każdy CREATE używa IF NOT EXISTS — bezpieczne uruchomienie wielokrotne.║
-- ║ Wszystkie używają CONCURRENTLY — nie blokują tabeli przy tworzeniu.   ║
-- ║ UWAGA: CONCURRENTLY musi być uruchomione poza transakcją —             ║
-- ║         jeśli SQL Editor wyrzuca błąd, uruchom każdy CREATE osobno.   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── points_log ──────────────────────────────────────────────────────────
-- Hot-path: leaderboard, week ranking, season avg.
CREATE INDEX IF NOT EXISTS idx_points_log_user_date
  ON points_log (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_points_log_date
  ON points_log (date);  -- range scan dla week/season window

-- ── profiles ────────────────────────────────────────────────────────────
-- Hot-path: leaderboard sortowanie, ranking.
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_points
  ON profiles (weekly_points DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username);

-- ── trainings ──────────────────────────────────────────────────────────
-- Hot-path: HomePage filtruje po kategorii i wieku.
CREATE INDEX IF NOT EXISTS idx_trainings_category
  ON trainings (category);

-- ── activity_log ───────────────────────────────────────────────────────
-- Hot-path: streak, raporty tygodniowe, achievements.
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date
  ON activity_log (user_id, date DESC);

-- ── shooting_sessions ──────────────────────────────────────────────────
-- Hot-path: StatsPage, achievements rzutowe.
CREATE INDEX IF NOT EXISTS idx_shooting_sessions_user_date
  ON shooting_sessions (user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_shooting_sessions_user_shot_type
  ON shooting_sessions (user_id, shot_type);

-- ── user_achievements ──────────────────────────────────────────────────
-- Hot-path: AchievementsPage, BottomNav (unread count), achievements lib.
CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unseen
  ON user_achievements (user_id) WHERE seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_base
  ON user_achievements (user_id, base_id);

-- ── club_matches ──────────────────────────────────────────────────────
-- Hot-path: ClubPage matches list (filtruje po statusie + dacie + lokalizacji).
CREATE INDEX IF NOT EXISTS idx_club_matches_status_date
  ON club_matches (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_club_matches_club_id
  ON club_matches (club_id);

CREATE INDEX IF NOT EXISTS idx_club_matches_away_club_id
  ON club_matches (away_club_id) WHERE away_club_id IS NOT NULL;

-- ── club_members ──────────────────────────────────────────────────────
-- Hot-path: BottomNav, ClubPage member resolution.
CREATE INDEX IF NOT EXISTS idx_club_members_user_id
  ON club_members (user_id);

CREATE INDEX IF NOT EXISTS idx_club_members_club_id
  ON club_members (club_id);

-- ── match_players ─────────────────────────────────────────────────────
-- Hot-path: ClubPage match details, BottomNav new-match check.
CREATE INDEX IF NOT EXISTS idx_match_players_match
  ON match_players (match_id);

CREATE INDEX IF NOT EXISTS idx_match_players_user
  ON match_players (user_id);

CREATE INDEX IF NOT EXISTS idx_match_players_user_joined
  ON match_players (user_id, joined_at DESC);

-- ── league_periods ────────────────────────────────────────────────────
-- Hot-path: LeaderboardDrawer (current period lookup).
CREATE INDEX IF NOT EXISTS idx_league_periods_starts_at
  ON league_periods (starts_at DESC);

-- ── weekly_reports ────────────────────────────────────────────────────
-- Hot-path: HomePage weekly report fetch.
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week
  ON weekly_reports (user_id, week_number DESC);

-- ── recovery_log ──────────────────────────────────────────────────────
-- Hot-path: RecoveryPage daily activity check.
CREATE INDEX IF NOT EXISTS idx_recovery_log_user_date
  ON recovery_log (user_id, date DESC);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ ANALYZE — odśwież statystyki Postgresa po dodaniu indeksów           ║
-- ╚══════════════════════════════════════════════════════════════════════╝
ANALYZE points_log;
ANALYZE profiles;
ANALYZE trainings;
ANALYZE activity_log;
ANALYZE shooting_sessions;
ANALYZE user_achievements;
ANALYZE club_matches;
ANALYZE club_members;
ANALYZE match_players;
ANALYZE league_periods;
ANALYZE weekly_reports;
ANALYZE recovery_log;
