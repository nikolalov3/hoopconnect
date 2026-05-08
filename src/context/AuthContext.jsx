import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bustAll } from '../lib/queryCache'

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        // No session — mark ready immediately so AppShell doesn't wait forever
        setProfileReady(true)
        profileReadyRef.current = true
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setProfileReady(true)
        profileReadyRef.current = true
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
