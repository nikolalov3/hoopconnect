import { supabase } from './supabase'

// Zgłoszenie nieodpowiedniej nazwy gracza (reaktywna połowa Apple 1.2 UGC).
// Jedno zgłoszenie na parę (reporter, zgłoszony) — duplikaty są cicho ignorowane.
export async function reportName(reportedUserId, reportedName, context = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !reportedUserId) return { ok: false }
  const { error } = await supabase.from('name_reports').upsert(
    { reporter_id: user.id, reported_user_id: reportedUserId, reported_name: reportedName, context },
    { onConflict: 'reporter_id,reported_user_id', ignoreDuplicates: true },
  )
  return { ok: !error, error }
}

// ── Blokowanie użytkowników (Apple 1.2 UGC — możliwość zablokowania) ──────────

// Lista id-ków, które bieżący user zablokował (RLS zwraca tylko własne wiersze).
export async function fetchBlockedIds() {
  const { data } = await supabase.from('blocked_users').select('blocked_id')
  return (data || []).map(r => r.blocked_id)
}

export async function blockUser(blockedId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !blockedId || user.id === blockedId) return { ok: false }
  const { error } = await supabase.from('blocked_users').upsert(
    { blocker_id: user.id, blocked_id: blockedId },
    { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
  )
  return { ok: !error, error }
}

export async function unblockUser(blockedId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !blockedId) return { ok: false }
  const { error } = await supabase.from('blocked_users')
    .delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
  return { ok: !error, error }
}
