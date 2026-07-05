-- ============================================================================
-- Reset klubow po utracie danych (2026-07-05)
--
-- club_members, match_players, team_practice, points_log, user_achievements,
-- activity_log, shooting_sessions, kotc_sessions, coach_profiles zostaly
-- znalezione PUSTE (0 wierszy) na zywej bazie, przyczyna nieznana (nie kod
-- apki — sprawdzone: zero sciezek w src/ moglo to spowodowac). clubs (5) i
-- club_matches (6) przetrwaly, ale sa teraz martwymi powlokami — kluby bez
-- czlonkow, mecze bez graczy.
--
-- Decyzja: pelny reset wszystkich 5 klubow (potwierdzone), zamiast probowac
-- zrekonstruowac dane, ktorych i tak nie ma z czego odtworzyc (match_players
-- — jedyny trop na sklad — jest rowniez pusty). profiles (19 kont) NIE sa
-- ruszane — to prawdziwe konta userow, zostaja nietkniete.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- Defensywnie: away_club_id moze nie miec cascade (dodany poza sledzonymi
-- migracjami) — wyczysc zanim usuniemy kluby, zeby nie trafic na FK violation.
UPDATE public.club_matches SET away_club_id = NULL WHERE away_club_id IS NOT NULL;

-- Usun wszystkie mecze (i tak osierocone, 0 graczy w match_players).
DELETE FROM public.club_matches;

-- Usun wszystkie czlonkostwa (juz puste, ale defensywnie).
DELETE FROM public.club_members;

-- Usun wszystkie kluby — pelny reset, kazdy wlasciciel zaczyna od nowa.
DELETE FROM public.clubs;
