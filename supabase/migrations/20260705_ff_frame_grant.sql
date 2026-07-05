-- ============================================================================
-- Ramka "Friends & Family" (ff) — przypisanie do konta nikolalovexo@gmail.com
-- Katalog ramki (id/path/rarity/label) zyje w kodzie: src/App.jsx (FRAMES),
-- ta migracja tylko ustawia equipped_frame na koncie.
-- Run once in Supabase SQL Editor.
-- ============================================================================

UPDATE public.profiles
SET equipped_frame = 'ff'
WHERE username = 'nikolalovexo@gmail.com';
