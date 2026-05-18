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

// Tabele filtrowane po user_id (sesje gracza)
const USER_TABLES = ['activity_log', 'points_log', 'shooting_sessions', 'strength_sessions']
// Tabele filtrowane po club_id (eventy klubowe — wymagają setClubScope)
const CLUB_TABLES = ['club_members', 'club_matches']

let channel  = null
let userId   = null
let clubId   = null
const listeners = new Map()   // table → Set<callback>

function buildChannel() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  if (!userId) return
  console.log('[RT] build', { userId, clubId })
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
  }
  channel.subscribe((status) => {
    console.log('[RT] status:', status)
  })
}

function dispatch(table, payload) {
  const fns = listeners.get(table)
  console.log(`[RT] ${table} ${payload.eventType}`, 'listeners:', fns?.size || 0, payload.new || payload.old)
  if (fns) fns.forEach((fn) => {
    try { fn(payload) } catch (e) { console.warn('[realtime listener]', e) }
  })
}

export function startRealtime(uid) {
  if (!uid) return
  if (channel && userId === uid) return
  userId = uid
  buildChannel()
}

export function setClubScope(cid) {
  if (clubId === cid) return
  clubId = cid || null
  if (userId) buildChannel()
}

export function stopRealtime() {
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
