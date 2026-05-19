import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/**
 * Single source of truth for the player's unread in-app notifications.
 *
 * Previously this lived in a useNotifications hook called from BOTH HomePage
 * (for the bell's red dot) and NotificationsSheet (for the list). Each call
 * created its own state — so accepting an invite refreshed the sheet but the
 * bell kept showing the dot. Lifting the state into a Provider fixes that.
 *
 * Updates flow through this provider:
 *   1. Optimistic: acceptTeamInvite/markRead remove the row from `items` first
 *      so the bell + sheet update in the same render
 *   2. Server sync: a load() follows the mutation to pick up anything else
 *   3. Realtime: a single Supabase channel covers concurrent updates from
 *      other devices / the coach panel
 */

const Ctx = createContext({
  items: [],
  unreadCount: 0,
  loading: false,
  reload: async () => {},
  acceptTeamInvite: async () => null,
  markRead: async () => {},
})

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, payload, read, action_url, created_at')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error) setItems(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Realtime: instant updates from coach panel inserts / cross-device reads.
  // Wrapped defensively — failures here must never crash the host page.
  useEffect(() => {
    if (!user?.id) return
    let channel = null
    let unmounted = false
    try {
      channel = supabase
        .channel(`notifications-rt-${user.id}`)
        .on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => { if (!unmounted) load() })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[notifications] realtime status:', status)
          }
        })
    } catch (err) {
      console.warn('[notifications] realtime subscribe failed:', err)
    }
    return () => {
      unmounted = true
      try { if (channel) supabase.removeChannel(channel) } catch {}
    }
  }, [user?.id, load])

  const acceptTeamInvite = useCallback(async (inviteId) => {
    setItems(prev => prev.filter(n => n.payload?.invite_id !== inviteId))
    const { data, error } = await supabase.rpc('accept_team_invite', { p_invite_id: inviteId })
    if (error) {
      await load()
      throw error
    }
    await load()
    return data
  }, [load])

  const declineTeamInvite = useCallback(async (inviteId) => {
    setItems(prev => prev.filter(n => n.payload?.invite_id !== inviteId))
    const { data, error } = await supabase.rpc('decline_team_invite', { p_invite_id: inviteId })
    if (error) {
      await load()
      throw error
    }
    await load()
    return data
  }, [load])

  const markRead = useCallback(async (notificationId) => {
    setItems(prev => prev.filter(n => n.id !== notificationId))
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
    if (error) await load()  // undo optimistic remove on failure
  }, [load])

  return (
    <Ctx.Provider value={{
      items,
      unreadCount: items.length,
      loading,
      reload: load,
      acceptTeamInvite,
      declineTeamInvite,
      markRead,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useNotifications = () => useContext(Ctx)
