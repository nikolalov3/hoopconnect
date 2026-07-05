-- ============================================================================
-- Fix: Security Definer View — public.club_roster (Supabase Advisor: CRITICAL)
--
-- Widok z 20260418_clubs.sql, tworzony domyslnie bez security_invoker=on,
-- wiec wykonuje sie z uprawnieniami tworcy widoku (nie query-ujacego usera) —
-- moze obchodzic RLS na clubs/club_members/profiles.
--
-- Sprawdzone w src/: widok NIGDZIE nie jest uzywany w apce (ClubPage.jsx
-- buduje roster bezposrednio z clubs/club_members). To martwy kod z
-- pierwszej wersji klubow — usuwamy, zamiast łatać flagą, zeby nie
-- utrzymywac nieuzywanej powierzchni ataku.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

DROP VIEW IF EXISTS public.club_roster;
