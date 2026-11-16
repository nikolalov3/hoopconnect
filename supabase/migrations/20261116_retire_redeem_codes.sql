-- ============================================================================
-- Kody na tła kart i ramki przestają być częścią produktu.
--
-- Własność motywu (user_unlocks) nadaje serwer (zakup na hoopconnect.pl albo ręczny grant), a aplikacja tylko
-- pokazuje to, co gracz już ma: z apki zniknęło pole „Masz kod?" (SettingsPanel), a Apple (wytyczna 3.1.1) zabrania
-- odblokowywania treści kodem wpisywanym w aplikacji.
--
-- Ta migracja zamyka też furtkę, która została po stronie bazy: funkcja redeem_code(text) jest wywoływalna przez API
-- przez każdego zalogowanego (UI nie jest potrzebne), a przykładowy kod z 20260814_card_customization.sql
-- (SMOK2026 → tło bg_dragon, 100 użyć) leży w publicznym repo. Przed jakąkolwiek sprzedażą motywów to musi być zamknięte.
--
-- Nie usuwa niczego, co gracze już mają: user_unlocks i code_redemptions zostają. Tylko odcina nowe realizacje kodów.
-- Uruchom raz w Supabase → SQL Editor. Idempotentne.
--
-- Sprawdzenie PRZED (tylko odczyt):
--   select code, item_id, max_uses, used_count, active from public.redeem_codes;
--   select count(*) as zrealizowane from public.code_redemptions;
-- Sprawdzenie PO (tylko odczyt):
--   select has_function_privilege('authenticated', 'public.redeem_code(text)', 'execute') as authenticated_moze;  -- false
--   select count(*) as aktywne_kody from public.redeem_codes where active;                                       -- 0
-- Cofnięcie: grant execute on function public.redeem_code(text) to authenticated;  oraz  update public.redeem_codes set active = true where ...;
-- ============================================================================

revoke execute on function public.redeem_code(text) from authenticated, anon, public;

update public.redeem_codes set active = false where active;
