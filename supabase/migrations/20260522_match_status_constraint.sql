-- Rozszerz CHECK constraint na status w club_matches o wartości używane
-- przez system wyników: 'result_pending' (oczekuje na potwierdzenie away)
-- i 'disputed' (kapitanowie mają sprzeczne wyniki).
--
-- Stary constraint: ('open','full','completed','cancelled')
-- Nowy constraint:  powyższe + 'result_pending' + 'disputed'

ALTER TABLE public.club_matches
  DROP CONSTRAINT IF EXISTS club_matches_status_check;

ALTER TABLE public.club_matches
  ADD CONSTRAINT club_matches_status_check
  CHECK (status IN ('open','full','completed','cancelled','result_pending','disputed'));
