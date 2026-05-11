import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Loads unread in-app notifications for the current player.
 *
 * Returns:
 *   - items:      array of notification rows (newest first)
 *   - unreadCount: number of items
 *   - reload():   refetch
 *   - acceptTeamInvite(inviteId) → { team_name }   wraps the RPC
 *   - markRead(notificationId)
 *
 * Re-fetches automatically when the tab becomes visible again — covers the
 * case where another device (e.g. coach panel) just inserted a notification.
 */
export function useNotifications() {
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

  // Refetch on tab focus so newly-created invites show up without a page reload
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const acceptTeamInvite = useCallback(async (inviteId) => {
    const { data, error } = await supabase.rpc('accept_team_invite', { p_invite_id: inviteId })
    if (error) throw error
    await load()
    return data
  }, [load])

  const markRead = useCallback(async (notificationId) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
    await load()
  }, [load])

  return {
    items,
    unreadCount: items.length,
    loading,
    reload: load,
    acceptTeamInvite,
    markRead,
  }
}
