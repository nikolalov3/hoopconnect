import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const AdminAuthContext = createContext({})

export const ADMIN_EMAIL = 'kontakt@hoopconnect.pl'

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback((email, password) =>
    supabase.auth.signInWithPassword({ email, password })
  , [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const isAdmin = !!user && (user.email || '').toLowerCase() === ADMIN_EMAIL

  return (
    <AdminAuthContext.Provider value={{ user, loading, signIn, signOut, isAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => useContext(AdminAuthContext)
