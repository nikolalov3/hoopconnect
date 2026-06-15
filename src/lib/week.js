// ── Globalny, kalendarzowy tydzień (reset co poniedziałek) ──────────────────
//
// Wcześniej `week_number` był liczony osobno w ~10 miejscach w kodzie jako
// "offset 7-dniowych okien od daty dołączenia gracza" — co sprawiało, że
// każdy gracz miał WŁASNY, przesunięty kalendarz tygodni (i co gorsza, dwie
// lekko różne formuły dawały rozjazdy w danych historycznych).
//
// Spec "System XP i Areny" mówi wprost: "Tygodniowy Draft Score resetuje się
// każdy poniedziałek" — czyli to ma być JEDEN, wspólny dla wszystkich,
// kalendarzowy tydzień. Te dwie funkcje są teraz JEDYNYM źródłem prawdy dla
// numeru tygodnia w całej aplikacji — wszystkie miejsca zapisujące/czytające
// `week_number` w `points_log` / `weekly_reports` powinny ich używać.
//
// Tydzień startuje w poniedziałek o północy UTC (spójnie z `TODAY =
// new Date().toISOString().split('T')[0]` używanym w HomePage/ShootingPage).

const WEEK_EPOCH_MS = Date.UTC(2024, 0, 1) // poniedziałek 2024-01-01 (UTC) — dowolny stały punkt odniesienia

/** Początek (poniedziałek 00:00 UTC) tygodnia kalendarzowego zawierającego `date`. */
export function startOfCalendarWeek(date = new Date()) {
  const d = new Date(date)
  const utcDay = d.getUTCDay() // 0 = niedziela ... 6 = sobota
  const diffToMonday = (utcDay + 6) % 7 // dni od ostatniego poniedziałku
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday))
}

/**
 * Globalny numer tygodnia (1-indeksowany, rośnie co poniedziałek o północy
 * UTC) — identyczny dla wszystkich graczy w danym tygodniu kalendarzowym.
 */
export function calendarWeekNumber(date = new Date()) {
  const monday = startOfCalendarWeek(date)
  const diffDays = Math.round((monday.getTime() - WEEK_EPOCH_MS) / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}
