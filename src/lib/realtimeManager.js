/**
 * Globalny singleton dla Supabase Realtime — JEDEN kanał per user przez cały
 * lifecycle sesji. Po starcie kanału nie przebudowujemy go (eliminuje race
 * conditions gdzie events gubiły się w trakcie rebuild'a). Auto-reconnect gdy WS padnie.
 *
 * API:
 *   startRealtime(userId, clubId?)  — wywołaj RAZ po loginie z pełnym scope
 *   stopRealtime()                  — logout / app close
 *   onTableChange(table, cb)        — subskrybuj zmiany; zwraca unsub
 */

import { supabase } from './supabase'

const USER_TABLES = ['activity_log', 'points_log', 'shooting_sessions', 'strength_sessions']
const CLUB_TABLES = ['club_members', 'club_matches']

let channel    = null
let userId     = null
let clubId     = null
let retryTimer = null
const listeners = new Map()

function buildChannel() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  if (!userId) return
  channel = supabase.channel(`user:${userId}`)
  for (const table of USER_TABLES) {
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload) => dispatch(table, payload)
    )
  }
  if (clubId) {
    for (const table of CLUB_TABLES) {
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `club_id=eq.${clubId}` },
        (payload) => dispatch(table, payload)
      )
    }
    // Mecze, w których klub jest GOŚCIEM: wiersz ma club_id = gospodarz, więc filtr
    // po club_id ich nie łapie — druga subskrypcja po away_club_id domyka „moje mecze"
    // (wynik, walkower, status wpisane przez gospodarza docierają też do gości).
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'club_matches', filter: `away_club_id=eq.${clubId}` },
      (payload) => dispatch('club_matches', payload)
    )
  }
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // Auto-reconnect z exponential backoff (1s start). Ratuje cross-device
      // sync gdy Safari zabije WS w tle albo Supabase zrestartuje połączenie.
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(() => { if (userId) buildChannel() }, 1500)
    }
  })
}

function dispatch(table, payload) {
  const fns = listeners.get(table)
  if (fns) fns.forEach((fn) => {
    try { fn(payload) } catch (e) { console.warn('[realtime listener]', e) }
  })
}

// Atomowy start — userId i clubId podawane razem, BEZ rebuild'ów per scope.
export function startRealtime(uid, cid = null) {
  if (!uid) return
  if (channel && userId === uid && clubId === (cid || null)) return
  userId = uid
  clubId = cid || null
  buildChannel()
}

// Compat: jeśli ktoś woła setClubScope osobno (np. gdy clubId zmienił się po
// dołączeniu do klubu w runtime), rebuild jest jednorazowy, nie cykliczny.
export function setClubScope(cid) {
  if (clubId === (cid || null)) return
  clubId = cid || null
  if (userId) buildChannel()
}

export function stopRealtime() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  userId = null
  clubId = null
  listeners.clear()
}

export function onTableChange(table, callback) {
  if (!USER_TABLES.includes(table) && !CLUB_TABLES.includes(table)) {
    console.warn(`[realtimeManager] nieznana tabela: ${table}`)
    return () => {}
  }
  if (!listeners.has(table)) listeners.set(table, new Set())
  const set = listeners.get(table)
  set.add(callback)
  return () => set.delete(callback)
}

// Supabase Realtime nie echuje zmian do tego samego połączenia — wywołaj lokalnie
// po każdym INSERT/UPDATE/DELETE zrobionym na tym samym urządzeniu.
export function dispatchLocal(table, eventType, newRow) {
  dispatch(table, { eventType, new: newRow, old: {} })
}
