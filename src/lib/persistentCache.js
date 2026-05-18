/**
 * Persistent cache (localStorage) — TYLKO dla statycznych zasobów które
 * rzadko się zmieniają (trainings, quotes, achievements catalog).
 *
 * Różni się od `queryCache`:
 *   - queryCache: in-memory Map, dies on reload
 *   - persistentCache: localStorage, survives reload → 0 round-tripów na nowej sesji
 *
 * Bustowane przez `BUILD_ID` change (patrz main.jsx) — bezpieczne dla deploy.
 */

const PREFIX = 'hc:pc:'

export function pGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, ts, ttl } = JSON.parse(raw)
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return data
  } catch { return null }
}

export function pSet(key, data, ttlMs = 24 * 60 * 60 * 1000) {  // 24h default
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl: ttlMs }))
  } catch (e) {
    // QuotaExceededError — pomijamy, fallback do queryCache nadal działa
    if (e?.name !== 'QuotaExceededError') console.warn('[pSet]', e)
  }
}

export function pBust(keyOrPrefix) {
  try {
    if (keyOrPrefix.endsWith('*')) {
      const prefix = PREFIX + keyOrPrefix.slice(0, -1)
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .forEach(k => localStorage.removeItem(k))
    } else {
      localStorage.removeItem(PREFIX + keyOrPrefix)
    }
  } catch {}
}

export function pBustAll() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}
