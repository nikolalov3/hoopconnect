import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bustAll } from '../lib/queryCache'
import { setSentryUser } from '../lib/sentry'
import { startRealtime, stopRealtime, setClubScope } from '../lib/realtimeManager'
import { fetchBlockedIds, blockUser as apiBlockUser, unblockUser as apiUnblockUser } from '../lib/moderation'

const AuthContext = createContext({})

// ── last_seen_at heartbeat ───────────────────────────────────────────────────
// Throttle: fire UPDATE tylko gdy minęło >= LAST_SEEN_THROTTLE_MS od ostatniego.
// Pamięta w localStorage między reloadami, żeby F5 nie generował pingu.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000  // 5 min
const lastSeenStorageKey = (uid) => `hc_last_seen_ping_${uid}`

async function pingLastSeen(userId) {
  if (!userId) return
  const key = lastSeenStorageKey(userId)
  const lastPing = +localStorage.getItem(key) || 0
  if (Date.now() - lastPing < LAST_SEEN_THROTTLE_MS) return

  localStorage.setItem(key, String(Date.now()))
  // Fire-and-forget — nie blokuje UI, nie await, ignoruje błędy
  supabase.from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) {
        // Cofnij throttle przy błędzie, żeby następny tick spróbował znowu
        localStorage.removeItem(key)
      }
    })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // profileReady: true once the FIRST profile fetch completes — never goes back to false.
  // This prevents token-refresh events from re-blocking the UI with a spinner.
  const [profileReady, setProfileReady] = useState(false)
  const profileReadyRef = useRef(false)
  // recovery: true po kliknięciu w link "reset hasła" z maila (event PASSWORD_RECOVERY).
  // Gdy true, App pokazuje ekran ustawienia nowego hasła zamiast normalnej apki.
  const [recovery, setRecovery] = useState(false)
  // Zbiór id-ków użytkowników zablokowanych przez bieżącego usera (Apple 1.2).
  const [blockedIds, setBlockedIds] = useState(() => new Set())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // startRealtime FIRST (sets userId) so fetchProfile's later setClubScope
        // rebuilds the channel with club scope instead of being ignored.
        startRealtime(session.user.id)
        fetchProfile(session.user.id, session.user)
      } else {
        setProfileReady(true)
        profileReadyRef.current = true
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // Link "reset hasła" z maila loguje usera i emituje PASSWORD_RECOVERY.
      // Podnosimy flagę → App pokaże ekran ustawienia nowego hasła.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          profileReadyRef.current = false
          setProfileReady(false)
          startRealtime(session.user.id)
          fetchProfile(session.user.id, session.user)
        }
      } else {
        stopRealtime()
        setProfile(null)
        setBlockedIds(new Set())
        setProfileReady(true)
        profileReadyRef.current = true
        // Nie zostawiaj profilu w localStorage po wylogowaniu / usunięciu konta.
        try { Object.keys(localStorage).filter(k => k.startsWith('hc:profile:')).forEach(k => localStorage.removeItem(k)) } catch { /* localStorage zablokowany */ }
      }
    })

    return () => {
      subscription.unsubscribe()
      stopRealtime()
    }
  }, [])

  // Tag Sentry events with the current user — makes errors actionable
  useEffect(() => {
    setSentryUser(user)
  }, [user?.id])

  // ── Heartbeat: aktualizuj last_seen_at przy każdym otwarciu/refocusie ──────
  // Throttle 5 min w pingLastSeen() — bezpiecznie wołać często.
  useEffect(() => {
    if (!user?.id) return
    pingLastSeen(user.id)  // initial ping (boot/login)

    const onVisible = () => {
      if (document.visibilityState === 'visible') pingLastSeen(user.id)
    }
    const onFocus = () => pingLastSeen(user.id)

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id])

  // sessionUser is passed in by callers (from getSession / onAuthStateChange) so we
  // avoid a redundant getSession() here. Only the profiles query gates first paint;
  // the username backfill and club-scope lookup run fire-and-forget after paint.
  const markReady = () => {
    if (!profileReadyRef.current) {
      profileReadyRef.current = true
      setProfileReady(true)
    }
  }

  async function fetchProfile(userId, sessionUser, attempt = 0) {
    try {
      // maybeSingle: 0 rows → { data: null, error: null } (genuine "no profile"),
      // a real failure → error set. This lets us tell "no row" from "fetch failed".
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error

      // Backfill username if missing (DB trigger may create the row without email).
      // Show it optimistically now; persist in the background (don't block paint).
      const prof = (data && !data.username && sessionUser?.email) ? { ...data, username: sessionUser.email } : data
      if (prof && prof !== data) {
        supabase.from('profiles').update({ username: sessionUser.email }).eq('id', userId)
          .then(() => {}, () => {})
      }
      setProfile(prof)
      // Ostatni dobry profil na tym urządzeniu — fallback dla zimnego startu bez sieci
      // (gałąź catch niżej). Czyszczone przy wylogowaniu.
      try { if (prof) localStorage.setItem(`hc:profile:${userId}`, JSON.stringify(prof)) } catch { /* localStorage zablokowany */ }

      // Unblock the render gate as soon as the profile is in.
      markReady()

      // Club scope only configures realtime (adds a .on() on the same channel so
      // club_members/club_matches events arrive instantly). Off the paint gate.
      supabase.from('club_members').select('club_id').eq('user_id', userId).maybeSingle()
        .then(({ data: mb }) => setClubScope(mb?.club_id || null), () => {})

      // Blocked-users list (for hiding blocked users' content). Off the paint gate.
      fetchBlockedIds().then(ids => setBlockedIds(new Set(ids))).catch(() => {})
    } catch {
      // Transient failure (e.g. a cold-start network race in the iOS home-screen PWA).
      // Do NOT mark ready with a null profile — that flashes the onboarding screen at
      // an already-logged-in user (App routes to /onboarding when profile is null).
      // Retry a few times first; only give up (and unblock) after several attempts.
      if (attempt < 4) {
        setTimeout(() => fetchProfile(userId, sessionUser, attempt + 1), 400 * (attempt + 1))
        return
      }
      // Sieć padła na dobre (np. zimny start natywnej apki w trybie samolotowym):
      // użyj ostatniego dobrego profilu z tego urządzenia zamiast null — null wysłałby
      // zalogowanego usera na ONBOARDING. Realtime / resync po powrocie sieci odświeży.
      let cached = null
      try { cached = JSON.parse(localStorage.getItem(`hc:profile:${userId}`) || 'null') } catch { /* brak / uszkodzony */ }
      setProfile(cached)
      markReady()
    }
  }

  // Optimistic block/unblock — update the set now, roll back if the write fails.
  async function blockUser(id) {
    if (!id) return false
    setBlockedIds(prev => new Set(prev).add(id))
    const { ok } = await apiBlockUser(id)
    if (!ok) setBlockedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    return ok
  }
  async function unblockUser(id) {
    if (!id) return false
    setBlockedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    const { ok } = await apiUnblockUser(id)
    if (!ok) setBlockedIds(prev => new Set(prev).add(id))
    return ok
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password) {
    return supabase.auth.signUp({ email, password })
  }

  async function signOut() {
    bustAll()
    profileReadyRef.current = false
    setProfileReady(false)
    return supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id, user)
  }

  function setProfileData(data) {
    setProfile(prev => ({ ...prev, ...data }))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileReady, recovery, clearRecovery: () => setRecovery(false), blockedIds, blockUser, unblockUser, signIn, signUp, signOut, refreshProfile, setProfileData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
