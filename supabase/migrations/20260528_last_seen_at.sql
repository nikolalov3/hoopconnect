-- Dodaje kolumnę last_seen_at — prawdziwy timestamp "ostatni raz w aplikacji".
-- Różni się od istniejącego last_active (DATE), który anchoruje logikę streak'a:
--   last_active   = data ostatniej zaliczonej aktywności (trening/regen/mecz)
--   last_seen_at  = dokładny moment ostatniego otwarcia / focusu aplikacji
--
-- Aktualizowane z frontu (AuthContext) z throttlowaniem co 5 min, żeby nie spamować DB.
-- Indeks DESC dla list typu "ostatnio online" / "aktywni dziś" / cohort queries.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC NULLS LAST);

-- Backfill: dla istniejących userów ustaw initial wartość z last_active (jeśli jest)
-- lub created_at — wtedy nikt nie wygląda jak "nigdy nie widziany" w dashboardzie.
UPDATE public.profiles
   SET last_seen_at = COALESCE(
     CASE WHEN last_active IS NOT NULL THEN last_active::timestamptz END,
     created_at
   )
 WHERE last_seen_at IS NULL;
