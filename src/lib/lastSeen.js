/**
 * formatLastSeen — formatuje timestamp ostatniej obecności w aplikacji.
 *
 * Zwraca polski string typu:
 *   "online"        — <2 min temu
 *   "5 min temu"    — 2–59 min
 *   "3 godz temu"   — 1–23 godz
 *   "wczoraj"       — dokładnie 1 dzień
 *   "3 dni temu"    — 2–6 dni
 *   "tydz temu"     — 7–13 dni
 *   "3 tyg temu"    — 14–27 dni
 *   "2 mies temu"   — 1–11 mies
 *   "rok temu"      — 12+ mies
 *
 * Bezpieczny na null/undefined → 'nigdy'.
 */
export function formatLastSeen(ts) {
  if (!ts) return 'nigdy'
  const t = typeof ts === 'string' ? new Date(ts).getTime() : +ts
  if (Number.isNaN(t)) return 'nigdy'

  const diffSec = Math.max(0, (Date.now() - t) / 1000)
  const min  = diffSec / 60
  const hour = min / 60
  const day  = hour / 24

  if (min < 2)   return 'online'
  if (min < 60)  return `${Math.floor(min)} min temu`
  if (hour < 24) return `${Math.floor(hour)} godz temu`
  if (day < 2)   return 'wczoraj'
  if (day < 7)   return `${Math.floor(day)} dni temu`
  if (day < 14)  return 'tydz temu'
  if (day < 28)  return `${Math.floor(day / 7)} tyg temu`
  if (day < 365) return `${Math.floor(day / 30)} mies temu`
  return Math.floor(day / 365) === 1 ? 'rok temu' : `${Math.floor(day / 365)} lat temu`
}

/**
 * Czy użytkownik jest "online" (był aktywny w ciągu ostatnich 2 min).
 * Używaj do zielonej kropki obok awatara.
 */
export function isOnline(ts) {
  if (!ts) return false
  const t = typeof ts === 'string' ? new Date(ts).getTime() : +ts
  if (Number.isNaN(t)) return false
  return (Date.now() - t) < 2 * 60 * 1000
}
