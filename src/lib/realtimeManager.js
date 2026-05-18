/**
 * Globalny singleton dla Supabase Realtime — JEDEN kanał per user przez cały
 * lifecycle sesji zamiast osobnego kanału per page.
 *
 * Korzyść: 3× headroom na Supabase concurrent-channels limit (Free: 200 → ~600
 * efektywnie, bo każdy user trzymał poprzednio 2-3 kanały, teraz 1).
 *
 * API:
 *   startRealtime(userId)      — wywołaj raz po loginie (idempotent)
 *   stopRealtime()             — wywołaj na logout / app close
 *   onTableChange(table, cb)   — subskrybuj zmiany w danej tabeli; zwraca unsub
 *
 * Listenery są lokalne (Set per table) — odpięcie/przepięcie kosztuje 0 round-tripów.
 */

import { supabase } from './supabase'

const TABLES = ['activity_log', 'points_log', 'shooting_sessions', 'strength_sessions']

let channel  = null
let userId   = null
const listeners = new Map()   // table → Set<callback>

export function startRealtime(uid) {
  if (!uid) return
  if (channel && userId === uid) return  // już aktywny dla tego usera
  if (channel) stopRealtime()
  userId = uid
  channel = supabase.channel(`user:${uid}`)
  for (const table of TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` },
      (payload) => {
        const fns = listeners.get(table)
        if (fns) fns.forEach((fn) => {
          try { fn(payload) } catch (e) { console.warn('[realtime listener]', e) }
        })
      }
    )
  }
  channel.subscribe()
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  userId = null
  listeners.clear()
}

export function onTableChange(table, callback) {
  if (!TABLES.includes(table)) {
    console.warn(`[realtimeManager] nieznana tabela: ${table}`)
    return () => {}
  }
  if (!listeners.has(table)) listeners.set(table, new Set())
  const set = listeners.get(table)
  set.add(callback)
  return () => set.delete(callback)
}
