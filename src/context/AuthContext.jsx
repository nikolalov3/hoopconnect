import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bustAll } from '../lib/queryCache'
import { setSentryUser } from '../lib/sentry'
import { startRealtime, stopRealtime, setClubScope } from '../lib/realtimeManager'

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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Start realtime od razu (z user_id filterami). Gdy fetchProfile
        // ustali club_id, ewentualnie dorzuca CLUB_TABLES — rebuild raz.
        startRealtime(session.user.id)
        fetchProfile(session.user.id)
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
          fetchProfile(session.user.id)
        }
      } else {
        stopRealtime()
        setProfile(null)
        setProfileReady(true)
        profileReadyRef.current = true
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

  async function fetchProfile(userId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const sessionUser = sessionData?.session?.user

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      // Backfill username if missing (happens when DB trigger creates row without email)
      if (data && !data.username && sessionUser?.email) {
        await supabase
          .from('profiles')
          .update({ username: sessionUser.email })
          .eq('id', userId)
        setProfile({ ...data, username: sessionUser.email })
      } else {
        setProfile(data)
      }

      // Pobierz club_id i ustaw realtime scope (1 dodatkowy .on() na tym samym
      // channelu, bez nowych channeli). Dzięki temu eventy club_members /
      // club_matches lecą instant zamiast czekać na 2-min poll.
      const { data: mb } = await supabase
        .from('club_members').select('club_id')
        .eq('user_id', userId).maybeSingle()
      setClubScope(mb?.club_id || null)
    } catch {
      setProfile(null)
    } finally {
      // Only set profileReady once — subsequent token refreshes don't retrigger spinner
      if (!profileReadyRef.current) {
        profileReadyRef.current = true
        setProfileReady(true)
      }
    }
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
    if (user) await fetchProfile(user.id)
  }

  function setProfileData(data) {
    setProfile(prev => ({ ...prev, ...data }))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileReady, recovery, clearRecovery: () => setRecovery(false), signIn, signUp, signOut, refreshProfile, setProfileData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
