import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Zwraca listę treningów drużynowych dla zalogowanego gracza, zaplanowanych na DZIŚ.
 * Auto-odświeża przez Realtime gdy trener doda/edytuje/usunie trening
 * w którejkolwiek z drużyn gracza.
 */
export function useTodayTeamPractice() {
  const { user } = useAuth()
  const [practices, setPractices] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) { setPractices([]); return }
    setLoading(true)
    const start = new Date(); start.setHours(0,0,0,0)
    const end   = new Date(start); end.setDate(end.getDate() + 1)
    const { data, error } = await supabase.rpc('get_my_practice', {
      p_from: start.toISOString(),
      p_to:   end.toISOString(),
    })
    if (!error) setPractices(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Refetch when tab becomes visible
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  // Realtime: dowolna zmiana w team_practice → odśwież.
  // (Realtime nie da się filtrować po JOIN z team_members, więc słuchamy
  // wszystkich zmian na tabeli i robimy refetch — get_my_practice po stronie
  // serwera zwraca tylko nasze drużyny.)
  useEffect(() => {
    if (!user?.id) return
    let channel = null
    try {
      channel = supabase
        .channel(`my-practice-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'team_practice',
        }, () => load())
        .subscribe()
    } catch (err) {
      console.warn('[practice] realtime subscribe failed:', err)
    }
    return () => { try { if (channel) supabase.removeChannel(channel) } catch {} }
  }, [user?.id, load])

  return { practices, loading, reload: load }
}
