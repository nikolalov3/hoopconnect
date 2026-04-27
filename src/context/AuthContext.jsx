import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }, [])

  const signIn = useCallback((email, password) =>
    supabase.auth.signInWithPassword({ email, password }), [])

  const signUp = useCallback((email, password) =>
    supabase.auth.signUp({ email, password }), [])

  const signOut = useCallback(() =>
    supabase.auth.signOut(), [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  const setProfileData = useCallback((data) => {
    setProfile(prev => ({ ...prev, ...data }))
  }, [])

  const value = useMemo(() => ({
    user, profile, loading, signIn, signUp, signOut, refreshProfile, setProfileData,
  }), [user, profile, loading, signIn, signUp, signOut, refreshProfile, setProfileData])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
