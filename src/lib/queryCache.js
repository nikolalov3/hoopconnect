/**
 * Prosty in-memory cache dla zapytań Supabase.
 * Żyje przez całą sesję (moduł singleton) — przeżywa unmount/remount komponentów.
 * Dzięki temu zmiana karty = natychmiastowe dane z cache + ciche odświeżenie w tle.
 */

const _store = new Map()

/**
 * Pobierz dane z cache.
 * @returns {any|null} dane lub null jeśli brak / wygasłe
 */
export function getCache(key) {
  const e = _store.get(key)
  if (!e) return null
  if (Date.now() - e.ts > e.ttl) { _store.delete(key); return null }
  return e.data
}

/**
 * Zapisz dane do cache.
 * @param {number} ttlMs - czas życia w ms (domyślnie 5 minut)
 */
export function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  _store.set(key, { data, ts: Date.now(), ttl: ttlMs })
}

/** Wyczyść konkretny klucz (np. po zapisie danych przez użytkownika) */
export function bustCache(key) {
  _store.delete(key)
}

/** Wyczyść wszystko (np. po wylogowaniu) */
export function bustAll() {
  _store.clear()
}
