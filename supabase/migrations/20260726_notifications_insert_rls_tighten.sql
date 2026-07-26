-- ============================================================================
-- HoopConnect — uszczelnienie RLS na public.notifications (INSERT)
--
-- PROBLEM
-- Polityka "coach creates notif for players" miała postać:
--
--     WITH CHECK ( type = 'team_invite' OR user_id IN (<roster trenera>) )
--
-- Pierwszy człon nie był niczym ograniczony, więc DOWOLNY zalogowany
-- użytkownik (także zwykły zawodnik albo ktoś, kto właśnie założył konto
-- trenera) mógł wstawić wiersz z type = 'team_invite', dowolnym user_id,
-- dowolnym payloadem JSONB i dowolnym action_url. Czyli wysłać fałszywe
-- „zaproszenie do drużyny" z własnym linkiem do dowolnej osoby w systemie —
-- w praktyce do nieletnich. Wektor phishingu i spamu, nie wyciek danych.
--
-- DLACZEGO MOŻNA TO PO PROSTU USUNĄĆ
-- Żadna legalna ścieżka aplikacji nie wstawia powiadomień z klienta:
--   * invite_player(), remove_team_member(), broadcast — to funkcje
--     SECURITY DEFINER, które sprawdzają is_team_coach() i omijają RLS,
--   * kod front-endu na notifications robi wyłącznie SELECT oraz
--     UPDATE read = true (src/context/NotificationsContext.jsx).
-- Furtka nie obsługiwała więc żadnej funkcji produktu — zostawiała tylko
-- otwarte drzwi.
--
-- ZMIANA
-- Zostaje wyłącznie wstawianie do własnego rosteru. Gdyby w przyszłości
-- jakiś ekran potrzebował tworzyć powiadomienia po stronie klienta,
-- właściwą drogą jest kolejny RPC z SECURITY DEFINER, tak jak reszta.
-- ============================================================================

DROP POLICY IF EXISTS "coach creates notif for players" ON public.notifications;

CREATE POLICY "coach creates notif for players"
  ON public.notifications FOR INSERT WITH CHECK (
    user_id IN (
      SELECT tm.player_id
        FROM public.team_members tm
        JOIN public.teams t ON t.id = tm.team_id
       WHERE t.coach_id = auth.uid()
    )
  );

-- Weryfikacja po uruchomieniu — powinno zwrócić dokładnie jeden wiersz,
-- a w kolumnie with_check nie może być już 'team_invite':
--
--   SELECT policyname, cmd, with_check
--     FROM pg_policies
--    WHERE tablename = 'notifications' AND cmd = 'INSERT';
