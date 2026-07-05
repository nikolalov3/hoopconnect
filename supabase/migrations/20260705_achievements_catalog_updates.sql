-- ============================================================================
-- Achievements catalog updates (2026-07-05)
-- 1) Early Bird i Yoga: srebro -> zloto (rzadkosc)
--    Zero migracji danych w user_achievements — sprawdzone w HomePage.jsx:
--    dla early_bird kluczem jest `early_bird_${data}` (jedno na dzien),
--    dla yoga (ma training_id) kluczem jest `yoga_${licznik}` (addUnlock()).
--    Medal NIGDY nie jest czescia zapisanego achievement_id dla tych dwoch —
--    UI bierze zawsze stages[0] (patrz AchievementsPage.jsx linia ~370),
--    wiec zmiana medalu w katalogu jest w 100% bezpieczna, nie tworzy sierot.
-- 2) Roller: soft-delete (is_active=false) — NIE hard delete.
--    fetchAchievementsCatalog() filtruje .eq('is_active', true), a
--    AchievementsPage.jsx buduje karty ITERUJAC PO catalog (nie po
--    user_achievements), wiec is_active=false chowa Rollera calkowicie,
--    bez mozliwosci osieroconej karty — sprawdzone w kodzie (linia ~365).
--    Dodatkowo: w calym src/ nie ma ZADNEGO miejsca, ktore odblokowuje
--    'roller' (brak training_id, brak dedykowanego triggera) — jedyna
--    droga to dev-only przycisk "odblokuj wszystkie" na koncie deva,
--    wiec realnie prawdopodobnie nikt tego nie ma.
-- 3) KotC lipiec: rename na wersje z lokalizacja (Park Jordana) — sama
--    zmiana nazwy, bez gatingu lokalizacji (to osobna faza, patrz
--    notatka w Obsidianie "Osiagniecia — lista i grafiki").
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1) Early Bird: silver -> gold
UPDATE public.achievements_catalog
SET stages = '[{"image": "/achievements/early_bird.png", "label": "Złoto", "medal": "gold", "threshold": 1}]'::jsonb
WHERE id = 'early_bird';

-- 1b) Yoga: silver -> gold
UPDATE public.achievements_catalog
SET stages = '[{"image": "/achievements/yoga.png", "label": "Złoto", "medal": "gold", "threshold": 1}]'::jsonb
WHERE id = 'yoga';

-- 2) Roller: usuwamy z widoku (soft-delete)
UPDATE public.achievements_catalog
SET is_active = false
WHERE id = 'roller';

-- 3) KotC lipiec: rename z lokalizacja w nazwie (Park Jordana)
UPDATE public.achievements_catalog
SET title = 'King of the Court · Park Jordana · Lipiec'
WHERE id = 'kotc_win_july';

UPDATE public.achievements_catalog
SET title = 'Gracz King of the Court · Park Jordana · Lipiec'
WHERE id = 'kotc_play_july';
