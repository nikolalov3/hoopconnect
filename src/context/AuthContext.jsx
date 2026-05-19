import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bustAll } from '../lib/queryCache'
import { setSentryUser } from '../lib/sentry'
import { startRealtime, stopRealtime, setClubScope } from '../lib/realtimeManager'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // profileReady: true once the FIRST profile fetch completes — never goes back to false.
  // This prevents token-refresh events from re-blocking the UI with a spinner.
  const [profileReady, setProfileReady] = useState(false)
  const profileReadyRef = useRef(false)

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
    <AuthContext.Provider value={{ user, profile, loading, profileReady, signIn, signUp, signOut, refreshProfile, setProfileData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
