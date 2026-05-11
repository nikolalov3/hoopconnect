import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const CoachAuthContext = createContext({})

const LS_CURRENT_TEAM = 'hc_coach_current_team'

/**
 * Coach panel auth + team state.
 *
 * - Shares the global Supabase auth.users with the player app, but the *profile*
 *   row for coaches lives in `coach_profiles`, not `profiles`.
 * - A coach can own multiple teams (U14 + U16 + senior). We expose `teams`,
 *   `currentTeam`, and `setCurrentTeam` so every coach page operates on the
 *   selected team. The selection is persisted to localStorage so the next visit
 *   resumes where the coach left off.
 */
export function CoachAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [coachProfile, setCoachProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [currentTeamId, setCurrentTeamIdState] = useState(() => {
    try { return localStorage.getItem(LS_CURRENT_TEAM) || null } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const profileReadyRef = useRef(false)

  // ── Session bootstrap + onAuthStateChange ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadCoachData(session.user.id)
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
          loadCoachData(session.user.id)
        }
      } else {
        setCoachProfile(null)
        setTeams([])
        setProfileReady(true)
        profileReadyRef.current = true
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Loaders ───────────────────────────────────────────────────────────────
  async function loadCoachData(userId) {
    try {
      const [{ data: profile }, { data: teamsList }] = await Promise.all([
        supabase.from('coach_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('teams').select('*').eq('coach_id', userId).is('archived_at', null).order('created_at', { ascending: true }),
      ])

      setCoachProfile(profile || null)
      setTeams(teamsList || [])

      // Validate or pick a default currentTeamId
      const list = teamsList || []
      if (list.length === 0) {
        setCurrentTeamIdState(null)
        try { localStorage.removeItem(LS_CURRENT_TEAM) } catch {}
      } else {
        const stored = (() => { try { return localStorage.getItem(LS_CURRENT_TEAM) } catch { return null } })()
        const valid = stored && list.some(t => t.id === stored)
        const next = valid ? stored : list[0].id
        setCurrentTeamIdState(next)
        try { localStorage.setItem(LS_CURRENT_TEAM, next) } catch {}
      }
    } catch (e) {
      console.error('[CoachAuth] loadCoachData failed', e)
      setCoachProfile(null)
      setTeams([])
    } finally {
      if (!profileReadyRef.current) {
        profileReadyRef.current = true
        setProfileReady(true)
      }
    }
  }

  const refreshCoach = useCallback(async () => {
    if (user) await loadCoachData(user.id)
  }, [user])

  const refreshTeams = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('teams').select('*')
      .eq('coach_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
    setTeams(data || [])
    // If currentTeam disappeared (deleted/archived), fall back to first
    if (data && data.length > 0 && !data.some(t => t.id === currentTeamId)) {
      setCurrentTeam(data[0].id)
    }
  }, [user, currentTeamId])

  // ── Public actions ────────────────────────────────────────────────────────
  const signIn = useCallback((email, password) =>
    supabase.auth.signInWithPassword({ email, password })
  , [])

  const signUp = useCallback(async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { data, error }
    // Create coach_profiles row immediately (RLS lets us insert with id=auth.uid())
    if (data?.user) {
      const { error: profileErr } = await supabase.from('coach_profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email,
      })
      if (profileErr) return { data, error: profileErr }
    }
    return { data, error: null }
  }, [])

  const signOut = useCallback(async () => {
    profileReadyRef.current = false
    setProfileReady(false)
    try { localStorage.removeItem(LS_CURRENT_TEAM) } catch {}
    return supabase.auth.signOut()
  }, [])

  const setCurrentTeam = useCallback((teamId) => {
    setCurrentTeamIdState(teamId)
    try {
      if (teamId) localStorage.setItem(LS_CURRENT_TEAM, teamId)
      else localStorage.removeItem(LS_CURRENT_TEAM)
    } catch {}
  }, [])

  // Derive currentTeam object
  const currentTeam = teams.find(t => t.id === currentTeamId) || null

  return (
    <CoachAuthContext.Provider value={{
      user,
      coachProfile,
      teams,
      currentTeam,
      currentTeamId,
      loading,
      profileReady,
      signIn,
      signUp,
      signOut,
      setCurrentTeam,
      refreshCoach,
      refreshTeams,
    }}>
      {children}
    </CoachAuthContext.Provider>
  )
}

export const useCoachAuth = () => useContext(CoachAuthContext)
